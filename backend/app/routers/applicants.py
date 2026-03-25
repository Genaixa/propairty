from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.applicant import Applicant, STAGES, TERMINAL_STAGES
from app.models.property import Property
from app.models.unit import Unit
from app import notifications

router = APIRouter(prefix="/api/applicants", tags=["applicants"])


def _out(a: Applicant):
    prop = a.property
    unit = a.unit
    return {
        "id": a.id,
        "full_name": a.full_name,
        "email": a.email,
        "phone": a.phone,
        "source": a.source,
        "status": a.status,
        "viewing_date": a.viewing_date.isoformat() if a.viewing_date else None,
        "desired_move_in": a.desired_move_in.isoformat() if a.desired_move_in else None,
        "monthly_budget": a.monthly_budget,
        "notes": a.notes,
        "property_id": a.property_id,
        "unit_id": a.unit_id,
        "property_name": prop.name if prop else None,
        "unit_name": unit.name if unit else None,
        "property_address": f"{prop.address_line1}, {prop.city}" if prop else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


class ApplicantCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    property_id: Optional[int] = None
    unit_id: Optional[int] = None
    viewing_date: Optional[datetime] = None
    desired_move_in: Optional[date] = None
    monthly_budget: Optional[str] = None
    notes: Optional[str] = None
    status: str = "enquiry"


class ApplicantUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    property_id: Optional[int] = None
    unit_id: Optional[int] = None
    viewing_date: Optional[datetime] = None
    desired_move_in: Optional[date] = None
    monthly_budget: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
def list_applicants(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Applicant).filter(Applicant.organisation_id == current_user.organisation_id)
    if status:
        q = q.filter(Applicant.status == status)
    return [_out(a) for a in q.order_by(Applicant.created_at.desc()).all()]


@router.get("/pipeline")
def pipeline_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_applicants = db.query(Applicant).filter(
        Applicant.organisation_id == current_user.organisation_id
    ).all()
    counts = {s: 0 for s in STAGES + TERMINAL_STAGES}
    for a in all_applicants:
        if a.status in counts:
            counts[a.status] += 1
    return {
        "counts": counts,
        "total_active": sum(counts[s] for s in STAGES),
        "total": len(all_applicants),
    }


@router.post("")
def create_applicant(
    data: ApplicantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify property/unit belong to org if given
    if data.property_id:
        prop = db.query(Property).filter(
            Property.id == data.property_id,
            Property.organisation_id == current_user.organisation_id,
        ).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

    applicant = Applicant(
        organisation_id=current_user.organisation_id,
        **data.model_dump(),
    )
    db.add(applicant)
    db.commit()
    db.refresh(applicant)

    # Telegram alert for new applicant
    prop = applicant.property
    unit = applicant.unit
    location = f"{prop.name}{' · ' + unit.name if unit else ''}" if prop else "unspecified property"
    notifications.send(
        f"🏠 <b>New Applicant</b>\n\n"
        f"Name: {applicant.full_name}\n"
        f"Property: {location}\n"
        f"Source: {applicant.source or '—'}\n"
        f"Phone: {applicant.phone or '—'}"
    )

    return _out(applicant)


@router.put("/{applicant_id}")
def update_applicant(
    applicant_id: int,
    data: ApplicantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    applicant = db.query(Applicant).filter(
        Applicant.id == applicant_id,
        Applicant.organisation_id == current_user.organisation_id,
    ).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    old_status = applicant.status
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(applicant, field, value)
    db.commit()
    db.refresh(applicant)

    # Alert on key stage transitions
    new_status = applicant.status
    if new_status != old_status:
        prop = applicant.property
        unit = applicant.unit
        location = f"{prop.name}{' · ' + unit.name if unit else ''}" if prop else "—"
        stage_emoji = {
            "viewing_booked": "📅",
            "viewed": "👀",
            "referencing": "🔍",
            "approved": "✅",
            "tenancy_created": "🎉",
            "rejected": "❌",
            "withdrawn": "🚫",
        }.get(new_status, "➡️")
        notifications.send(
            f"{stage_emoji} <b>Applicant: {new_status.replace('_', ' ').title()}</b>\n\n"
            f"Applicant: {applicant.full_name}\n"
            f"Property: {location}\n"
            f"Stage: {old_status.replace('_', ' ')} → {new_status.replace('_', ' ')}"
        )

    return _out(applicant)


@router.delete("/{applicant_id}")
def delete_applicant(
    applicant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    applicant = db.query(Applicant).filter(
        Applicant.id == applicant_id,
        Applicant.organisation_id == current_user.organisation_id,
    ).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    db.delete(applicant)
    db.commit()
    return {"ok": True}


@router.get("/units-available")
def available_units(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all properties and units for the dropdown."""
    props = db.query(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()
    result = []
    for p in props:
        for u in p.units:
            result.append({
                "property_id": p.id,
                "property_name": p.name,
                "unit_id": u.id,
                "unit_name": u.name,
                "label": f"{p.name} — {u.name}",
            })
    return result
