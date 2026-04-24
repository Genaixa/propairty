from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import get_current_user, get_accessible_property_ids
from app.models.user import User
from app.models.tenant import Tenant
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.models.payment import RentPayment
from app.models.maintenance import MaintenanceRequest
from app.models.deposit import TenancyDeposit
from app.models.organisation import Organisation
from app.schemas.tenant import TenantCreate, TenantOut
from app import emails as _emails, audit

router = APIRouter(prefix="/api/tenants", tags=["tenants"])

@router.get("", response_model=List[TenantOut])
def list_tenants(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    allowed = get_accessible_property_ids(db, current_user)
    if allowed is not None:
        # Filter tenants to those in units in accessible properties
        accessible_unit_ids = [
            u.id for u in db.query(Unit).filter(Unit.property_id.in_(allowed)).all()
        ]
        # Get tenant IDs from active leases on those units
        lease_tenant_ids = {
            l.tenant_id for l in db.query(Lease).filter(Lease.unit_id.in_(accessible_unit_ids)).all()
            if l.tenant_id
        }
        return db.query(Tenant).filter(
            Tenant.organisation_id == current_user.organisation_id,
            Tenant.id.in_(lease_tenant_ids),
        ).all()
    return db.query(Tenant).filter(Tenant.organisation_id == current_user.organisation_id).all()

@router.post("", response_model=TenantOut)
def create_tenant(data: TenantCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = Tenant(**data.model_dump(), organisation_id=current_user.organisation_id)
    db.add(tenant)
    db.flush()
    audit.log_action(
        db,
        organisation_id=current_user.organisation_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        action="created",
        entity_type="tenant",
        entity_id=tenant.id,
        entity_name=tenant.full_name,
    )
    db.commit()
    db.refresh(tenant)
    return tenant

@router.get("/{tenant_id}/profile")
def get_tenant_profile(tenant_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    leases = db.query(Lease).filter(Lease.tenant_id == tenant_id).order_by(Lease.start_date.desc()).all()

    leases_out = []
    for lease in leases:
        unit = db.query(Unit).get(lease.unit_id)
        prop = db.query(Property).get(unit.property_id) if unit else None
        payments = db.query(RentPayment).filter(RentPayment.lease_id == lease.id).order_by(RentPayment.due_date.desc()).limit(24).all()
        deposit = db.query(TenancyDeposit).filter(TenancyDeposit.lease_id == lease.id).first()
        leases_out.append({
            "id": lease.id,
            "status": lease.status,
            "start_date": str(lease.start_date) if lease.start_date else None,
            "end_date": str(lease.end_date) if lease.end_date else None,
            "rent_amount": lease.monthly_rent,
            "property": prop.name if prop else None,
            "unit": unit.name if unit else None,
            "property_id": prop.id if prop else None,
            "unit_id": unit.id if unit else None,
            "payments": [{"id": p.id, "due_date": str(p.due_date), "amount_due": p.amount_due,
                          "amount_paid": p.amount_paid, "status": p.status} for p in payments],
            "deposit": {"id": deposit.id, "amount": deposit.amount, "scheme": deposit.scheme,
                        "status": deposit.status} if deposit else None,
        })

    # Match by tenant_id link or by name (legacy)
    maintenance = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.organisation_id == current_user.organisation_id,
        (MaintenanceRequest.reported_by_tenant_id == tenant.id) |
        (MaintenanceRequest.reported_by == tenant.full_name)
    ).order_by(MaintenanceRequest.created_at.desc()).limit(50).all()

    return {
        "id": tenant.id,
        "full_name": tenant.full_name,
        "email": tenant.email,
        "phone": tenant.phone,
        "whatsapp_number": tenant.whatsapp_number,
        "notes": tenant.notes,
        "avatar_url": tenant.avatar_url,
        "portal_enabled": tenant.portal_enabled,
        "is_active": tenant.is_active,
        "leases": leases_out,
        "maintenance": [{
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "status": m.status,
            "priority": m.priority,
            "assigned_to": m.assigned_to,
            "estimated_cost": m.estimated_cost,
            "actual_cost": m.actual_cost,
            "created_at": str(m.created_at)[:10],
        } for m in maintenance],
    }

@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(tenant_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.put("/{tenant_id}", response_model=TenantOut)
def update_tenant(tenant_id: int, data: TenantCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    for k, v in data.model_dump().items():
        setattr(tenant, k, v)
    db.commit()
    db.refresh(tenant)
    return tenant

@router.post("/{tenant_id}/set-active")
def set_tenant_active(tenant_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.is_active = True
    db.commit()
    return {"ok": True}

@router.post("/{tenant_id}/set-inactive")
def set_tenant_inactive(tenant_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.is_active = False
    db.commit()
    return {"ok": True}

@router.delete("/{tenant_id}")
def delete_tenant(tenant_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    active = db.query(Lease).filter(Lease.tenant_id == tenant_id, Lease.status == "active").first()
    if active:
        raise HTTPException(status_code=400, detail="Cannot delete tenant with an active lease. End the lease first.")
    db.delete(tenant)
    db.commit()
    return {"ok": True}


# --- Tenant Messages (agent inbox) ---

from app.models.tenant_message import TenantMessage as TenantMessageModel
from pydantic import BaseModel as _BaseModel

class AgentMessageCreate(_BaseModel):
    body: str

@router.get("/{tenant_id}/messages")
def get_tenant_messages(tenant_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    msgs = db.query(TenantMessageModel).filter(
        TenantMessageModel.tenant_id == tenant_id
    ).order_by(TenantMessageModel.created_at.asc()).all()
    # Mark tenant messages as read from agent's perspective
    for m in msgs:
        if m.sender_type == "tenant" and not m.read:
            m.read = True
    db.commit()
    return [
        {
            "id": m.id,
            "sender_type": m.sender_type,
            "sender_name": m.sender_name,
            "body": m.body,
            "read": m.read,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in msgs
    ]

@router.post("/{tenant_id}/messages")
def send_tenant_message(tenant_id: int, data: AgentMessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    msg = TenantMessageModel(
        organisation_id=current_user.organisation_id,
        tenant_id=tenant_id,
        sender_type="agent",
        sender_name=current_user.full_name or current_user.email,
        body=data.body.strip(),
        read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    # Notify tenant via their chosen channels
    try:
        org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
        agent_name = current_user.full_name or current_user.email
        _emails.send_portal_message_notification(
            tenant, agent_name, data.body.strip(), org,
            "https://propairty.co.uk/tenant/portal"
        )
    except Exception as e:
        print(f"[email] tenant reply notify failed: {e}")
    return {
        "id": msg.id,
        "sender_type": msg.sender_type,
        "sender_name": msg.sender_name,
        "body": msg.body,
        "read": msg.read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }

@router.get("/messages/inbox")
def agent_messages_inbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return all tenant conversations for this org, grouped by tenant, most recent first."""
    from sqlalchemy import func as sqlfunc
    msgs = db.query(TenantMessageModel).filter(
        TenantMessageModel.organisation_id == current_user.organisation_id
    ).order_by(TenantMessageModel.created_at.desc()).all()

    # Group by tenant
    seen = {}
    for m in msgs:
        if m.tenant_id not in seen:
            tenant = db.query(Tenant).filter(Tenant.id == m.tenant_id).first()
            seen[m.tenant_id] = {
                "tenant_id": m.tenant_id,
                "tenant_name": tenant.full_name if tenant else "Unknown",
                "tenant_email": tenant.email if tenant else "",
                "last_message": m.body,
                "last_message_at": m.created_at.isoformat() if m.created_at else None,
                "last_sender": m.sender_type,
                "unread": 0,
            }
        if m.sender_type == "tenant" and not m.read:
            seen[m.tenant_id]["unread"] += 1

    return list(seen.values())


# --- Meter readings (agent view) ---

from app.models.meter_reading import MeterReading

@router.get("/meter-readings")
def list_meter_readings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """All meter readings for this org, newest first."""
    from sqlalchemy import desc
    readings = (
        db.query(MeterReading)
        .join(Tenant, Tenant.id == MeterReading.tenant_id)
        .filter(Tenant.organisation_id == current_user.organisation_id)
        .order_by(desc(MeterReading.reading_date), desc(MeterReading.id))
        .limit(500)
        .all()
    )
    result = []
    for r in readings:
        tenant = db.query(Tenant).filter(Tenant.id == r.tenant_id).first()
        unit = db.query(Unit).filter(Unit.id == r.unit_id).first()
        prop = db.query(Property).filter(Property.id == unit.property_id).first() if unit else None
        result.append({
            "id": r.id,
            "tenant_name": tenant.full_name if tenant else "Unknown",
            "property": prop.name if prop else "—",
            "unit": unit.name if unit else "—",
            "meter_type": r.meter_type,
            "reading": r.reading,
            "reading_date": r.reading_date.isoformat() if r.reading_date else None,
            "notes": r.notes,
            "submitted_by": r.submitted_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return result


from pydantic import BaseModel as _BM
from typing import Optional as _Opt
from datetime import date as _date

class MeterReadingCreate(_BM):
    tenant_id: int
    meter_type: str
    reading: float
    reading_date: str  # ISO date
    notes: _Opt[str] = None

@router.post("/meter-readings")
def create_meter_reading(data: MeterReadingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Agent logs a meter reading."""
    tenant = db.query(Tenant).filter(Tenant.id == data.tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        raise HTTPException(status_code=400, detail="Tenant has no active lease")
    reading = MeterReading(
        organisation_id=current_user.organisation_id,
        tenant_id=tenant.id,
        unit_id=lease.unit_id,
        meter_type=data.meter_type,
        reading=data.reading,
        reading_date=_date.fromisoformat(data.reading_date),
        notes=data.notes,
        submitted_by="agent",
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    unit = db.query(Unit).filter(Unit.id == reading.unit_id).first()
    prop = db.query(Property).filter(Property.id == unit.property_id).first() if unit else None
    return {
        "id": reading.id,
        "tenant_name": tenant.full_name,
        "property": prop.name if prop else "—",
        "unit": unit.name if unit else "—",
        "meter_type": reading.meter_type,
        "reading": reading.reading,
        "reading_date": reading.reading_date.isoformat(),
        "notes": reading.notes,
        "submitted_by": reading.submitted_by,
        "created_at": reading.created_at.isoformat() if reading.created_at else None,
    }
