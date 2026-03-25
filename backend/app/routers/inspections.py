import html
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.inspection import Inspection, InspectionRoom
from app.models.unit import Unit
from app.models.property import Property
from app.models.tenant import Tenant
from app.models.lease import Lease
from app.models.organisation import Organisation
from app import emails, notifications, docgen

router = APIRouter(prefix="/api/inspections", tags=["inspections"])

CONDITION_LABELS = {
    "excellent": "Excellent",
    "good": "Good",
    "fair": "Fair",
    "poor": "Poor",
}

INSPECTION_TYPES = ["routine", "check_in", "check_out", "inventory"]


class RoomIn(BaseModel):
    room_name: str
    condition: Optional[str] = None
    cleanliness: Optional[str] = None
    notes: Optional[str] = None


class InspectionCreate(BaseModel):
    unit_id: int
    type: str
    scheduled_date: date
    inspector_name: Optional[str] = None
    notes: Optional[str] = None


class InspectionUpdate(BaseModel):
    status: Optional[str] = None
    completed_date: Optional[date] = None
    overall_condition: Optional[str] = None
    inspector_name: Optional[str] = None
    notes: Optional[str] = None
    rooms: Optional[list[RoomIn]] = None


def _inspection_out(i: Inspection) -> dict:
    return {
        "id": i.id,
        "unit_id": i.unit_id,
        "property": i.unit.property.name if i.unit else None,
        "unit": i.unit.name if i.unit else None,
        "property_address": (
            f"{i.unit.property.address_line1}, {i.unit.property.city}"
            if i.unit and i.unit.property else None
        ),
        "type": i.type,
        "status": i.status,
        "scheduled_date": i.scheduled_date.isoformat() if i.scheduled_date else None,
        "completed_date": i.completed_date.isoformat() if i.completed_date else None,
        "inspector_name": i.inspector_name,
        "overall_condition": i.overall_condition,
        "notes": i.notes,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "rooms": [
            {
                "id": r.id,
                "room_name": r.room_name,
                "condition": r.condition,
                "cleanliness": r.cleanliness,
                "notes": r.notes,
            }
            for r in i.rooms
        ],
    }


def _check_unit_access(unit_id: int, current_user: User, db: Session) -> Unit:
    unit = db.query(Unit).join(Property).filter(
        Unit.id == unit_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.get("")
def list_inspections(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Inspection).join(Unit).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    )
    if status:
        q = q.filter(Inspection.status == status)
    return [_inspection_out(i) for i in q.order_by(Inspection.scheduled_date.desc()).all()]


@router.post("")
def create_inspection(
    data: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    unit = _check_unit_access(data.unit_id, current_user, db)

    inspection = Inspection(
        organisation_id=current_user.organisation_id,
        unit_id=data.unit_id,
        type=data.type,
        scheduled_date=data.scheduled_date,
        inspector_name=data.inspector_name,
        notes=data.notes,
        status="scheduled",
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)

    # Notify tenant by email if they have portal access
    _notify_tenant_inspection_scheduled(inspection, unit, db)

    # Telegram alert
    notifications.send(
        f"📋 <b>Inspection Scheduled</b>\n\n"
        f"Property: {unit.property.name} · {unit.name}\n"
        f"Type: {data.type.replace('_', ' ').title()}\n"
        f"Date: {data.scheduled_date.strftime('%-d %B %Y')}"
        + (f"\nInspector: {data.inspector_name}" if data.inspector_name else "")
    )

    return _inspection_out(inspection)


@router.put("/{inspection_id}")
def update_inspection(
    inspection_id: int,
    data: InspectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inspection = db.query(Inspection).join(Unit).join(Property).filter(
        Inspection.id == inspection_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    if data.status is not None:
        inspection.status = data.status
    if data.completed_date is not None:
        inspection.completed_date = data.completed_date
    if data.overall_condition is not None:
        inspection.overall_condition = data.overall_condition
    if data.inspector_name is not None:
        inspection.inspector_name = data.inspector_name
    if data.notes is not None:
        inspection.notes = data.notes

    if data.rooms is not None:
        # Replace rooms
        for r in inspection.rooms:
            db.delete(r)
        db.flush()
        for room in data.rooms:
            db.add(InspectionRoom(
                inspection_id=inspection.id,
                room_name=room.room_name,
                condition=room.condition,
                cleanliness=room.cleanliness,
                notes=room.notes,
            ))

    db.commit()
    db.refresh(inspection)
    return _inspection_out(inspection)


@router.delete("/{inspection_id}")
def delete_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inspection = db.query(Inspection).join(Unit).join(Property).filter(
        Inspection.id == inspection_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    db.delete(inspection)
    db.commit()
    return {"ok": True}


@router.get("/{inspection_id}/report")
def download_report(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inspection = db.query(Inspection).join(Unit).join(Property).filter(
        Inspection.id == inspection_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    org = db.query(Organisation).filter(
        Organisation.id == current_user.organisation_id
    ).first()

    # Find active tenant for this unit
    lease = db.query(Lease).filter(
        Lease.unit_id == inspection.unit_id,
        Lease.status == "active"
    ).first()
    tenant = lease.tenant if lease else None

    pdf_bytes = docgen.generate_inspection_report(inspection, org, tenant)
    filename = f"inspection-{inspection_id}-{inspection.scheduled_date}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


def _notify_tenant_inspection_scheduled(inspection: Inspection, unit: Unit, db: Session):
    lease = db.query(Lease).filter(
        Lease.unit_id == unit.id,
        Lease.status == "active"
    ).first()
    if not lease or not lease.tenant or not lease.tenant.email:
        return
    tenant = lease.tenant
    org = db.query(Organisation).filter(Organisation.id == inspection.organisation_id).first()
    org_name = org.name if org else "Your Letting Agent"

    type_label = inspection.type.replace("_", " ").title()
    date_str = inspection.scheduled_date.strftime("%-d %B %Y")

    subject = f"Property inspection scheduled — {date_str}"
    safe_tenant_name = html.escape(tenant.full_name.split()[0])
    safe_property = html.escape(f"{unit.property.name}, {unit.name}")
    safe_inspector = html.escape(inspection.inspector_name) if inspection.inspector_name else None
    safe_notes = html.escape(inspection.notes) if inspection.notes else None
    body = f"""
    <h2>Inspection Notice</h2>
    <p>Hi {safe_tenant_name},</p>
    <p>We have scheduled a <strong>{type_label}</strong> inspection of your property.</p>
    <div class="amount-box">
      <div class="label">Inspection Date</div>
      <div class="amount" style="font-size:22px">{date_str}</div>
    </div>
    <p><strong>Property:</strong> {safe_property}</p>
    {f"<p><strong>Inspector:</strong> {safe_inspector}</p>" if safe_inspector else ""}
    {f"<p><strong>Notes:</strong> {safe_notes}</p>" if safe_notes else ""}
    <p>Please ensure the property is accessible on the day. If you have any questions or need to rearrange, please contact us.</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
    """
    html = emails._base_template(subject, body, org_name)
    emails._send_email(tenant.email, subject, html)
