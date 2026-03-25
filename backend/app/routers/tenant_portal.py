from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token
from app.models.tenant import Tenant
from app.models.tenant_notification import TenantNotification
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.models.payment import RentPayment
from app.models.maintenance import MaintenanceRequest
from app.models.renewal import LeaseRenewal
from app.models.user import User
from app.schemas.auth import Token
from app.config import settings
from app import notifications
from app import password_reset as pr
from jose import JWTError, jwt
from sqlalchemy.sql import func as sqlfunc

router = APIRouter(prefix="/api/tenant", tags=["tenant-portal"])
limiter = Limiter(key_func=get_remote_address)

tenant_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/tenant/token")


def get_current_tenant(token: str = Depends(tenant_oauth2), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "tenant":
            raise ValueError("not a tenant token")
        tenant_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.portal_enabled == True).first()
    if not tenant:
        raise HTTPException(status_code=401, detail="Tenant portal access not enabled")
    return tenant


# --- Auth ---

@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
def tenant_login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.email == form_data.username, Tenant.portal_enabled == True).first()
    if not tenant or not tenant.hashed_password or not verify_password(form_data.password, tenant.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token({"sub": str(tenant.id), "type": "tenant"})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def tenant_me(tenant: Tenant = Depends(get_current_tenant)):
    return {"id": tenant.id, "full_name": tenant.full_name, "email": tenant.email, "phone": tenant.phone}


@router.post("/forgot-password")
@limiter.limit("5/minute")
def tenant_forgot(request: Request, req: pr.ForgotRequest, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.email == req.email, Tenant.portal_enabled == True).first()
    return pr.request_reset(req.email, "tenant", tenant.id if tenant else None, db)


@router.post("/reset-password")
def tenant_reset(req: pr.ResetRequest, db: Session = Depends(get_db)):
    return pr.do_reset(req.token, req.new_password, "tenant",
                       lambda uid, d: d.query(Tenant).filter(Tenant.id == uid).first(), db)


# --- Agent: enable portal for a tenant ---

def get_agent(token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/token")), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


class EnablePortalRequest(BaseModel):
    password: str


@router.post("/enable/{tenant_id}")
def enable_portal(tenant_id: int, req: EnablePortalRequest, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == agent.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not tenant.email:
        raise HTTPException(status_code=400, detail="Tenant has no email address")
    # Check email not already used by another portal-enabled tenant in this org
    conflict = db.query(Tenant).filter(
        Tenant.email == tenant.email,
        Tenant.portal_enabled == True,
        Tenant.id != tenant_id,
        Tenant.organisation_id == agent.organisation_id,
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="Another tenant with this email already has portal access")
    tenant.hashed_password = hash_password(req.password)
    tenant.portal_enabled = True
    db.commit()
    return {"ok": True, "email": tenant.email}


# --- Tenant portal views ---

@router.get("/portal/lease")
def portal_lease(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        # Fall back to most recent lease
        lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.start_date.desc()).first()
    if not lease:
        return None
    unit = lease.unit
    prop = unit.property if unit else None
    return {
        "id": lease.id,
        "status": lease.status,
        "start_date": lease.start_date.isoformat() if lease.start_date else None,
        "end_date": lease.end_date.isoformat() if lease.end_date else None,
        "monthly_rent": lease.monthly_rent,
        "deposit": lease.deposit,
        "rent_day": lease.rent_day,
        "is_periodic": lease.is_periodic,
        "unit_name": unit.name if unit else None,
        "property_name": prop.name if prop else None,
        "property_address": f"{prop.address_line1}, {prop.city}, {prop.postcode}" if prop else None,
    }


@router.get("/portal/payments")
def portal_payments(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    leases = db.query(Lease).filter(Lease.tenant_id == tenant.id).all()
    lease_ids = [l.id for l in leases]
    if not lease_ids:
        return []
    payments = db.query(RentPayment).filter(RentPayment.lease_id.in_(lease_ids)).order_by(RentPayment.due_date.desc()).limit(24).all()
    return [
        {
            "id": p.id,
            "due_date": p.due_date.isoformat() if p.due_date else None,
            "amount_due": p.amount_due,
            "amount_paid": p.amount_paid,
            "paid_date": p.paid_date.isoformat() if p.paid_date else None,
            "status": p.status,
        }
        for p in payments
    ]


@router.get("/portal/maintenance")
def portal_maintenance(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    jobs = db.query(MaintenanceRequest).filter(MaintenanceRequest.reported_by_tenant_id == tenant.id).order_by(MaintenanceRequest.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "title": j.title,
            "description": j.description,
            "priority": j.priority,
            "status": j.status,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


class MaintenanceSubmit(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"


@router.post("/portal/maintenance")
def submit_maintenance(req: MaintenanceSubmit, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        raise HTTPException(status_code=400, detail="No active lease found")
    unit = lease.unit
    job = MaintenanceRequest(
        organisation_id=tenant.organisation_id,
        property_id=unit.property_id,
        unit_id=unit.id,
        title=req.title,
        description=req.description,
        priority=req.priority,
        status="open",
        reported_by_tenant_id=tenant.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    # AI triage and dispatch queue
    try:
        from app.routers import dispatch as dispatch_router
        dispatch_router.enqueue_job(job, db)
    except Exception as e:
        print(f"[dispatch] enqueue failed: {e}")
    return {"id": job.id, "title": job.title, "status": job.status}


# --- Renewal portal endpoints ---

@router.get("/portal/renewal")
def portal_get_renewal(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Return any pending renewal offer for this tenant."""
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease or not lease.renewals:
        return None
    renewal = lease.renewals[0]
    if renewal.status != "sent":
        return None
    unit = lease.unit
    prop = unit.property if unit else None
    return {
        "id": renewal.id,
        "proposed_rent": renewal.proposed_rent,
        "proposed_start": renewal.proposed_start.isoformat(),
        "proposed_end": renewal.proposed_end.isoformat() if renewal.proposed_end else None,
        "is_periodic": renewal.is_periodic,
        "agent_notes": renewal.agent_notes,
        "current_rent": lease.monthly_rent,
        "property": prop.name if prop else None,
        "unit": unit.name if unit else None,
    }


class RenewalResponse(BaseModel):
    accept: bool
    tenant_notes: Optional[str] = None


@router.post("/portal/renewal/{renewal_id}/respond")
def portal_respond_renewal(
    renewal_id: int,
    req: RenewalResponse,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    from app.routers.renewals import _accept_renewal

    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        raise HTTPException(status_code=404, detail="No active lease")

    renewal = db.query(LeaseRenewal).filter(
        LeaseRenewal.id == renewal_id,
        LeaseRenewal.lease_id == lease.id,
        LeaseRenewal.status == "sent"
    ).first()
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal offer not found")

    renewal.status = "accepted" if req.accept else "declined"
    renewal.tenant_notes = req.tenant_notes
    renewal.responded_at = sqlfunc.now()
    db.commit()

    unit = lease.unit
    prop = unit.property if unit else None
    notifications.send(
        f"{'✅' if req.accept else '❌'} <b>Renewal {'Accepted' if req.accept else 'Declined'}</b>\n\n"
        f"Tenant: {tenant.full_name}\n"
        f"Property: {prop.name if prop else '?'} · {unit.name if unit else '?'}"
        + (f"\nNotes: {req.tenant_notes}" if req.tenant_notes else "")
    )

    if req.accept:
        return _accept_renewal(renewal, db)

    return {"ok": True, "status": "declined"}


# --- In-portal notifications ---

def create_notification(db: Session, tenant_id: int, message: str, type: str = "info"):
    """Create a notification record for a tenant. Called by reminder and escalation logic."""
    notif = TenantNotification(tenant_id=tenant_id, message=message, type=type)
    db.add(notif)
    db.commit()


@router.get("/portal/notifications")
def portal_notifications(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    notifs = (
        db.query(TenantNotification)
        .filter(TenantNotification.tenant_id == tenant.id)
        .order_by(TenantNotification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "message": n.message,
            "type": n.type,
            "read": n.read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]


@router.post("/portal/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    notif = db.query(TenantNotification).filter(
        TenantNotification.id == notification_id,
        TenantNotification.tenant_id == tenant.id,
    ).first()
    if notif:
        notif.read = True
        db.commit()
    return {"ok": True}


@router.post("/portal/notifications/read-all")
def mark_all_notifications_read(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    db.query(TenantNotification).filter(
        TenantNotification.tenant_id == tenant.id,
        TenantNotification.read == False,
    ).update({"read": True})
    db.commit()
    return {"ok": True}
