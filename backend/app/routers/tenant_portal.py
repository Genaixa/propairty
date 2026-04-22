import uuid
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, status
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
from app.models.maintenance_note import MaintenanceNote
from app.models.contractor_review import ContractorReview
from app.models.renewal import LeaseRenewal
from app.models.upload import UploadedFile
from app.models.deposit import TenancyDeposit
from app.models.inspection import Inspection
from app.models.tenant_message import TenantMessage
from app.models.meter_reading import MeterReading

UPLOAD_DIR = Path("/root/propairty/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
from app.models.user import User
from app.models.organisation import Organisation
from app.schemas.auth import Token
from app.config import settings
from app import notifications, emails as _emails
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


class TenantProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


@router.patch("/me")
def update_tenant_me(data: TenantProfileUpdate, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    if data.full_name is not None:
        tenant.full_name = data.full_name.strip()
    if data.phone is not None:
        tenant.phone = data.phone.strip()
    db.commit()
    return {"id": tenant.id, "full_name": tenant.full_name, "email": tenant.email, "phone": tenant.phone}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/me/change-password")
def change_password(data: PasswordChange, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    from app.auth import verify_password, hash_password
    if not verify_password(data.current_password, tenant.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    tenant.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


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


@router.post("/disable/{tenant_id}")
def disable_portal(tenant_id: int, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == agent.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.portal_enabled = False
    tenant.hashed_password = None
    db.commit()
    return {"ok": True}


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
            "assigned_to": j.assigned_to,
            "actual_cost": j.actual_cost,
            "invoice_ref": j.invoice_ref,
            "tenant_satisfied": j.tenant_satisfied,
            "tenant_feedback": j.tenant_feedback,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "photos": [
                {"id": p.id, "url": f"/uploads/{p.filename}"}
                for p in db.query(UploadedFile).filter(
                    UploadedFile.entity_type == "maintenance",
                    UploadedFile.entity_id == j.id,
                    UploadedFile.mime_type.like("image/%"),
                ).order_by(UploadedFile.id).all()
            ],
        }
        for j in jobs
    ]


@router.post("/portal/maintenance/{job_id}/photos")
async def upload_maintenance_photos(
    job_id: int,
    files: list[UploadFile] = File(...),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Upload photos/videos for a maintenance request submitted by this tenant."""
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.reported_by_tenant_id == tenant.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    saved = []
    for file in files:
        if not file.content_type or not (
            file.content_type.startswith("image/") or file.content_type.startswith("video/")
        ):
            continue
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:  # 50 MB cap
            continue
        ext = Path(file.filename).suffix.lower() if file.filename else ""
        stored_name = f"{uuid.uuid4().hex}{ext}"
        (UPLOAD_DIR / stored_name).write_bytes(content)
        record = UploadedFile(
            organisation_id=tenant.organisation_id,
            entity_type="maintenance",
            entity_id=job.id,
            filename=stored_name,
            original_name=file.filename or stored_name,
            mime_type=file.content_type,
            file_size=len(content),
            category="photo",
        )
        db.add(record)
        saved.append(stored_name)

    db.commit()
    return {"uploaded": len(saved)}


class MaintenanceSubmit(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"


@router.post("/portal/maintenance")
def submit_maintenance(
    req: MaintenanceSubmit,
    background_tasks: BackgroundTasks,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
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

    # Email agents about new maintenance request
    try:
        prop = db.query(Property).filter(Property.id == unit.property_id).first()
        org = db.query(Organisation).filter(Organisation.id == tenant.organisation_id).first()
        agents = db.query(User).filter(User.organisation_id == tenant.organisation_id, User.is_active == True).all()
        agent_emails = [u.email for u in agents if u.email]
        _emails.send_agent_maintenance_raised(
            agent_emails, tenant, req.title, req.description or "", org,
            prop.name if prop else "", unit.name if unit else ""
        )
    except Exception as e:
        print(f"[email] maintenance notify failed: {e}")

    # Run slow AI work in the background — response returns immediately
    background_tasks.add_task(_triage_maintenance_bg, job.id, tenant.id, lease.id)

    return {"id": job.id, "title": job.title, "status": job.status}


def _triage_maintenance_bg(job_id: int, tenant_id: int, lease_id: int):
    """Background task: dispatch + AI triage after job is already saved."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        job = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == job_id).first()
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        lease = db.query(Lease).filter(Lease.id == lease_id).first()
        if not job or not tenant or not lease:
            return
        unit = lease.unit

        try:
            from app.routers import dispatch as dispatch_router
            dispatch_router.enqueue_job(job, db)
        except Exception as e:
            print(f"[dispatch] enqueue failed: {e}")

        try:
            from app.routers.intelligence import _claude
            from app.models.triage_item import TriageItem
            import json as _json, re as _re
            triage_prompt = f"""You are the inbox assistant for a UK letting agency. A tenant has submitted a maintenance request via their portal.

Tenant: {tenant.full_name}
Property: {unit.property.name if unit and unit.property else 'Unknown'} — {unit.name if unit else ''}
Issue title: {job.title}
Description: {job.description}
Priority reported by tenant: {job.priority}

Return as JSON:
{{
  "category": "maintenance_request",
  "urgency": "low/medium/high/urgent",
  "summary": "One precise sentence describing the issue",
  "suggested_reply": "A warm, professional reply from the agent acknowledging the issue, using the tenant's first name. 2-3 sentences.",
  "action_items": ["specific actions the agent must take"]
}}"""
            raw = _claude(triage_prompt, max_tokens=600)
            match = _re.search(r'\{.*\}', raw, _re.DOTALL)
            tdata = _json.loads(match.group()) if match else {}
            sender_profile = {
                "type": "tenant", "id": tenant.id, "name": tenant.full_name,
                "email": tenant.email, "phone": tenant.phone,
                "property": unit.property.name if unit and unit.property else None,
                "property_id": unit.property_id if unit else None,
                "unit": unit.name if unit else None,
                "unit_id": unit.id if unit else None,
                "lease_id": lease.id,
            }
            triage_item = TriageItem(
                organisation_id=tenant.organisation_id,
                source="portal_maintenance",
                from_name=tenant.full_name,
                from_email=tenant.email,
                subject=f"Maintenance: {job.title}",
                body=job.description,
                category="maintenance_request",
                urgency=tdata.get("urgency", job.priority),
                summary=tdata.get("summary", job.title),
                suggested_reply=tdata.get("suggested_reply"),
                action_items=tdata.get("action_items"),
                sender_profile=sender_profile,
                records_created=[{"type": "maintenance_request", "id": job.id, "label": f"Maintenance job #{job.id}"}],
                status="pending",
                ref_type="maintenance_request",
                ref_id=job.id,
            )
            db.add(triage_item)
            db.commit()
        except Exception as e:
            print(f"[triage] auto-triage failed: {e}")
    finally:
        db.close()


class TenantNoteCreate(BaseModel):
    body: str


@router.get("/portal/maintenance/{job_id}/notes")
def portal_maintenance_notes(job_id: int, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.reported_by_tenant_id == tenant.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    notes = db.query(MaintenanceNote).filter(
        MaintenanceNote.maintenance_request_id == job_id
    ).order_by(MaintenanceNote.created_at.asc()).all()
    return [
        {
            "id": n.id,
            "author_type": n.author_type,
            "author_name": n.author_name,
            "body": n.body,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notes
    ]


@router.post("/portal/maintenance/{job_id}/notes")
def portal_add_maintenance_note(
    job_id: int,
    data: TenantNoteCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.reported_by_tenant_id == tenant.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    note = MaintenanceNote(
        maintenance_request_id=job_id,
        author_type="tenant",
        author_name=tenant.full_name,
        body=data.body,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    unit = job.unit
    prop = unit.property if unit else None
    notifications.send(
        f"💬 <b>Tenant Note on Maintenance</b>\n\n"
        f"Job: {job.title}\n"
        f"Property: {prop.name if prop else '—'} · {unit.name if unit else '—'}\n"
        f"From: {tenant.full_name}\n"
        f"Note: {data.body}"
    )

    return {
        "id": note.id,
        "author_type": note.author_type,
        "author_name": note.author_name,
        "body": note.body,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


class SatisfactionResponse(BaseModel):
    satisfied: bool
    feedback: Optional[str] = None
    stars: Optional[int] = None
    comment: Optional[str] = None


@router.post("/portal/maintenance/{job_id}/satisfy")
def portal_satisfy_maintenance(
    job_id: int,
    data: SatisfactionResponse,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.reported_by_tenant_id == tenant.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.tenant_satisfied = data.satisfied
    job.tenant_feedback = data.feedback or None

    if not data.satisfied:
        job.status = "in_progress"

    # Create review if stars provided and contractor is assigned
    if data.stars and job.contractor_id and 1 <= data.stars <= 5:
        existing = db.query(ContractorReview).filter(
            ContractorReview.maintenance_request_id == job.id,
            ContractorReview.reviewer_type == "tenant",
        ).first()
        if existing:
            existing.stars = data.stars
            existing.comment = data.comment or data.feedback
        else:
            db.add(ContractorReview(
                contractor_id=job.contractor_id,
                maintenance_request_id=job.id,
                reviewer_type="tenant",
                reviewer_name=tenant.full_name,
                stars=data.stars,
                comment=data.comment or data.feedback,
            ))

    db.commit()

    unit = job.unit
    prop = unit.property if unit else None

    if data.satisfied:
        notifications.send(
            f"✅ <b>Tenant Confirmed Satisfied</b>\n\n"
            f"Job: {job.title}\n"
            f"Property: {prop.name if prop else '—'} · {unit.name if unit else '—'}\n"
            f"Tenant: {tenant.full_name}"
        )
    else:
        notifications.send(
            f"⚠️ <b>Tenant NOT Satisfied — Job Reopened</b>\n\n"
            f"Job: {job.title}\n"
            f"Property: {prop.name if prop else '—'} · {unit.name if unit else '—'}\n"
            f"Tenant: {tenant.full_name}"
            + (f"\nReason: {data.feedback}" if data.feedback else "")
        )

    return {"ok": True, "status": job.status}


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


# --- Legal notices portal endpoints ---

@router.get("/portal/notices")
def portal_get_notices(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    from app.models.notice import LegalNotice
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.id.desc()).first()
    if not lease:
        return []
    notices = db.query(LegalNotice).filter(LegalNotice.lease_id == lease.id).order_by(LegalNotice.served_date.desc()).all()
    return [
        {
            "id": n.id,
            "notice_type": n.notice_type,
            "served_date": n.served_date.isoformat() if n.served_date else None,
            "possession_date": n.possession_date.isoformat() if n.possession_date else None,
            "arrears_amount": n.arrears_amount,
            "custom_notes": n.custom_notes,
            "viewed_at": n.viewed_at.isoformat() if n.viewed_at else None,
        }
        for n in notices
    ]


@router.post("/portal/notices/{notice_id}/viewed")
def portal_mark_notice_viewed(
    notice_id: int,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    from app.models.notice import LegalNotice
    from datetime import datetime, timezone
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.id.desc()).first()
    if not lease:
        return {"ok": True}
    notice = db.query(LegalNotice).filter(
        LegalNotice.id == notice_id,
        LegalNotice.lease_id == lease.id,
    ).first()
    if notice and not notice.viewed_at:
        notice.viewed_at = datetime.now(timezone.utc)
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


# --- Documents ---

@router.get("/portal/documents")
def portal_documents(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    from sqlalchemy import or_, and_
    from app.models.signing_request import SigningRequest

    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.id.desc()).first()

    result = []

    if lease:
        unit = lease.unit
        prop = unit.property if unit else None

        entity_filters = [
            ("lease", lease.id),
            ("tenant", tenant.id),
        ]
        if unit:
            entity_filters.append(("unit", unit.id))
        if prop:
            entity_filters.append(("property", prop.id))

        docs = db.query(UploadedFile).filter(
            or_(*[
                and_(UploadedFile.entity_type == et, UploadedFile.entity_id == eid)
                for et, eid in entity_filters
            ]),
            UploadedFile.category != "photo",
        ).order_by(UploadedFile.created_at.desc()).all()

        result += [
            {
                "id": f"upload-{d.id}",
                "original_name": d.original_name,
                "category": d.category,
                "description": d.description,
                "mime_type": d.mime_type,
                "file_size": d.file_size,
                "entity_type": d.entity_type,
                "url": f"/uploads/{d.filename}",
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "source": "upload",
            }
            for d in docs
        ]

        # Signed documents from the e-signature system
        lease_ids = [l.id for l in db.query(Lease).filter(Lease.tenant_id == tenant.id).all()]
        signed_docs = db.query(SigningRequest).filter(
            SigningRequest.lease_id.in_(lease_ids),
            SigningRequest.signer_email == tenant.email,
            SigningRequest.status == "signed",
            SigningRequest.signed_pdf_path.isnot(None),
        ).order_by(SigningRequest.signed_at.desc()).all()

        result += [
            {
                "id": f"signed-{s.id}",
                "original_name": f"{s.doc_label} (Signed).pdf",
                "category": "signed_document",
                "description": f"Signed on {s.signed_at.strftime('%d %b %Y') if s.signed_at else '—'}",
                "mime_type": "application/pdf",
                "file_size": None,
                "entity_type": "signing_request",
                "url": f"/api/signing/{s.token}/download",
                "created_at": s.signed_at.isoformat() if s.signed_at else None,
                "source": "esign",
                "token": s.token,
                "doc_label": s.doc_label,
                "signed_at": s.signed_at.isoformat() if s.signed_at else None,
            }
            for s in signed_docs
        ]

    return result


# --- E-signature ---

class SignaturePayload(BaseModel):
    signature_data: str  # base64 PNG data URL

@router.post("/portal/documents/{doc_id}/sign")
def sign_document(
    doc_id: int,
    payload: SignaturePayload,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Tenant signs a document by submitting a base64 PNG of their signature."""
    from datetime import datetime
    # Verify doc belongs to this tenant's lease/unit/property
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.id.desc()).first()
    if not lease:
        raise HTTPException(status_code=400, detail="No lease found")

    unit = lease.unit
    prop = unit.property if unit else None
    valid_ids = {
        ("lease", lease.id),
        ("tenant", tenant.id),
    }
    if unit:
        valid_ids.add(("unit", unit.id))
    if prop:
        valid_ids.add(("property", prop.id))

    doc = db.query(UploadedFile).filter(UploadedFile.id == doc_id).first()
    if not doc or (doc.entity_type, doc.entity_id) not in valid_ids:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.signed_at:
        raise HTTPException(status_code=400, detail="Document already signed")

    if not payload.signature_data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid signature data")

    doc.signed_at = datetime.utcnow()
    doc.signed_by_name = tenant.full_name
    doc.signature_data = payload.signature_data
    db.commit()

    return {
        "ok": True,
        "signed_at": doc.signed_at.isoformat(),
        "signed_by_name": doc.signed_by_name,
    }


# --- Deposit ---

@router.get("/portal/deposit")
def portal_deposit(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.id.desc()).first()
    if not lease:
        return None
    deposit = db.query(TenancyDeposit).filter(TenancyDeposit.lease_id == lease.id).first()
    if not deposit:
        # Return basic info from lease if no deposit record
        if lease.deposit:
            return {"amount": lease.deposit, "scheme": None, "scheme_reference": None, "status": "unknown", "from_lease": True}
        return None
    return {
        "amount": deposit.amount,
        "scheme": deposit.scheme,
        "scheme_reference": deposit.scheme_reference,
        "received_date": deposit.received_date.isoformat() if deposit.received_date else None,
        "protected_date": deposit.protected_date.isoformat() if deposit.protected_date else None,
        "prescribed_info_date": deposit.prescribed_info_date.isoformat() if deposit.prescribed_info_date else None,
        "status": deposit.status,
        "return_amount": deposit.return_amount,
        "deductions": deposit.deductions,
        "deduction_reason": deposit.deduction_reason,
        "returned_date": deposit.returned_date.isoformat() if deposit.returned_date else None,
        "notes": deposit.notes,
    }


# --- Inspections ---

@router.get("/portal/inspections")
def portal_inspections(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.id.desc()).first()
    if not lease or not lease.unit:
        return []
    inspections = db.query(Inspection).filter(
        Inspection.unit_id == lease.unit_id
    ).order_by(Inspection.scheduled_date.desc()).all()
    return [
        {
            "id": i.id,
            "type": i.type,
            "status": i.status,
            "scheduled_date": i.scheduled_date.isoformat() if i.scheduled_date else None,
            "completed_date": i.completed_date.isoformat() if i.completed_date else None,
            "inspector_name": i.inspector_name,
            "overall_condition": i.overall_condition,
            "notes": i.notes,
        }
        for i in inspections
    ]


# --- Property info (utilities + emergency contacts) ---

@router.get("/portal/property-info")
def portal_property_info(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    import json
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.id.desc()).first()
    if not lease or not lease.unit:
        return {}
    unit = lease.unit
    prop = unit.property if unit else None
    if not prop:
        return {}

    def parse_json(val):
        if not val:
            return None
        try:
            return json.loads(val)
        except Exception:
            return None

    org = db.query(__import__('app.models.organisation', fromlist=['Organisation']).Organisation).filter_by(id=tenant.organisation_id).first()
    return {
        "property_name": prop.name,
        "address": f"{prop.address_line1}{', ' + prop.address_line2 if prop.address_line2 else ''}, {prop.city}, {prop.postcode}",
        "emergency_contacts": parse_json(prop.emergency_contacts) or [],
        "utility_info": parse_json(prop.utility_info) or {},
        "agency_phone": org.phone if org else None,
        "agency_email": org.email if org else None,
        "agency_name": org.name if org else None,
    }


# --- Full property view for tenant ---

@router.get("/portal/my-property")
def portal_my_property(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    import json
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        lease = db.query(Lease).filter(Lease.tenant_id == tenant.id).order_by(Lease.id.desc()).first()
    if not lease or not lease.unit:
        return None
    unit = lease.unit
    prop = unit.property if unit else None
    if not prop:
        return None

    def parse_json(val):
        if not val:
            return None
        try:
            return json.loads(val)
        except Exception:
            return None

    # Photos: property photos + unit photos
    photos = db.query(UploadedFile).filter(
        UploadedFile.entity_type.in_(["property", "unit"]),
        UploadedFile.entity_id.in_([prop.id, unit.id]),
        UploadedFile.mime_type.like("image/%"),
    ).order_by(UploadedFile.entity_type.desc(), UploadedFile.id).all()

    return {
        "property": {
            "name": prop.name,
            "address": f"{prop.address_line1}{', ' + prop.address_line2 if prop.address_line2 else ''}, {prop.city}, {prop.postcode}",
            "type": prop.property_type,
            "description": prop.description,
            "epc_rating": prop.epc_rating,
            "epc_potential": prop.epc_potential,
            "council_tax_band": prop.council_tax_band,
            "bills_included": prop.bills_included,
            "tenure": prop.tenure,
            "features": [f.strip() for f in prop.features.splitlines() if f.strip()] if prop.features else [],
        },
        "unit": {
            "name": unit.name,
            "bedrooms": unit.bedrooms,
            "bathrooms": unit.bathrooms,
            "reception_rooms": unit.reception_rooms,
            "furnished": unit.furnished,
            "amenities": parse_json(unit.amenities) or [],
            "occupancy_type": unit.occupancy_type,
            "max_occupants": unit.max_occupants,
        },
        "photos": [
            {"id": p.id, "url": f"/uploads/{p.filename}", "label": p.description or p.original_name, "entity_type": p.entity_type}
            for p in photos
        ],
    }


# --- Rent statement PDF ---

@router.get("/portal/rent-statement")
def portal_rent_statement(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Return payment history as JSON for PDF generation on frontend."""
    leases = db.query(Lease).filter(Lease.tenant_id == tenant.id).all()
    lease_ids = [l.id for l in leases]
    if not lease_ids:
        return {"tenant": tenant.full_name, "payments": []}
    payments = db.query(RentPayment).filter(RentPayment.lease_id.in_(lease_ids)).order_by(RentPayment.due_date.asc()).all()
    lease = leases[0]
    unit = lease.unit
    prop = unit.property if unit else None
    return {
        "tenant": tenant.full_name,
        "email": tenant.email,
        "property": prop.name if prop else "",
        "address": f"{prop.address_line1}, {prop.city}, {prop.postcode}" if prop else "",
        "unit": unit.name if unit else "",
        "payments": [
            {
                "due_date": p.due_date.isoformat() if p.due_date else None,
                "paid_date": p.paid_date.isoformat() if p.paid_date else None,
                "amount_due": p.amount_due,
                "amount_paid": p.amount_paid,
                "status": p.status,
            }
            for p in payments
        ],
        "generated": __import__('datetime').date.today().isoformat(),
    }


# --- Tenant messages (general inbox) ---

class TenantMessageCreate(BaseModel):
    body: str


@router.get("/portal/messages")
def portal_get_messages(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    msgs = db.query(TenantMessage).filter(
        TenantMessage.tenant_id == tenant.id
    ).order_by(TenantMessage.created_at.asc()).all()
    # Mark agent messages as read
    unread_agent = [m for m in msgs if m.sender_type == "agent" and not m.read]
    for m in unread_agent:
        m.read = True
    if unread_agent:
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


@router.post("/portal/messages")
def portal_send_message(data: TenantMessageCreate, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    if not data.body.strip():
        raise HTTPException(status_code=400, detail="Message body cannot be empty")
    msg = TenantMessage(
        organisation_id=tenant.organisation_id,
        tenant_id=tenant.id,
        sender_type="tenant",
        sender_name=tenant.full_name,
        body=data.body.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    unit = lease.unit if lease else None
    prop = unit.property if unit else None
    notifications.send(
        f"💬 <b>Tenant Message</b>\n\n"
        f"From: {tenant.full_name}\n"
        f"Property: {prop.name if prop else '—'}{' · ' + unit.name if unit else ''}\n\n"
        f"{data.body}"
    )
    # Email all agents in this org
    try:
        org = db.query(Organisation).filter(Organisation.id == tenant.organisation_id).first()
        agents = db.query(User).filter(User.organisation_id == tenant.organisation_id, User.is_active == True).all()
        agent_emails = [u.email for u in agents if u.email]
        _emails.send_agent_new_tenant_message(
            agent_emails, tenant, data.body.strip(), org,
            prop.name if prop else "", unit.name if unit else ""
        )
    except Exception as e:
        print(f"[email] agent message notify failed: {e}")
    return {
        "id": msg.id, "sender_type": msg.sender_type, "sender_name": msg.sender_name,
        "body": msg.body, "read": msg.read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


@router.get("/portal/messages/unread-count")
def portal_messages_unread(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    count = db.query(TenantMessage).filter(
        TenantMessage.tenant_id == tenant.id,
        TenantMessage.sender_type == "agent",
        TenantMessage.read == False,
    ).count()
    return {"count": count}


# --- RTR status ---

@router.get("/portal/rtr")
def portal_rtr(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    from datetime import date, timedelta
    today = date.today()
    if not tenant.rtr_check_date:
        return {"status": "not_recorded", "check_date": None, "expiry_date": None, "document_type": None, "days_remaining": None}
    if not tenant.rtr_expiry_date:
        return {"status": "valid", "check_date": str(tenant.rtr_check_date), "expiry_date": None, "document_type": tenant.rtr_document_type, "days_remaining": None}
    days = (tenant.rtr_expiry_date - today).days
    if days < 0:
        status = "expired"
    elif days <= 30:
        status = "expiring_soon"
    else:
        status = "valid"
    return {
        "status": status,
        "check_date": str(tenant.rtr_check_date),
        "expiry_date": str(tenant.rtr_expiry_date),
        "document_type": tenant.rtr_document_type,
        "days_remaining": days,
    }


# --- Meter readings ---

class MeterReadingCreate(BaseModel):
    meter_type: str   # electricity, gas, water
    reading: float
    reading_date: str  # ISO date
    notes: Optional[str] = None


@router.get("/portal/meter-readings")
def portal_get_meter_readings(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    readings = db.query(MeterReading).filter(
        MeterReading.tenant_id == tenant.id
    ).order_by(MeterReading.reading_date.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "meter_type": r.meter_type,
            "reading": r.reading,
            "reading_date": str(r.reading_date),
            "notes": r.notes,
            "submitted_by": r.submitted_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in readings
    ]


@router.post("/portal/meter-readings")
def portal_submit_meter_reading(data: MeterReadingCreate, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    from datetime import date as date_cls
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    if not lease:
        raise HTTPException(status_code=400, detail="No active lease")
    reading = MeterReading(
        organisation_id=tenant.organisation_id,
        tenant_id=tenant.id,
        unit_id=lease.unit_id,
        meter_type=data.meter_type,
        reading=data.reading,
        reading_date=date_cls.fromisoformat(data.reading_date),
        notes=data.notes,
        submitted_by="tenant",
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    unit = lease.unit
    prop = unit.property if unit else None
    notifications.send(
        f"📟 <b>Meter Reading Submitted</b>\n\n"
        f"Tenant: {tenant.full_name}\n"
        f"Property: {prop.name if prop else '—'}{' · ' + unit.name if unit else ''}\n"
        f"Type: {data.meter_type.title()}\n"
        f"Reading: {data.reading}\n"
        f"Date: {data.reading_date}"
    )
    return {"id": reading.id, "ok": True}


# --- Referencing status ---

@router.get("/portal/referencing")
def portal_referencing(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    from app.models.applicant import Applicant
    if not tenant.email:
        return None
    applicant = db.query(Applicant).filter(
        Applicant.email == tenant.email,
        Applicant.organisation_id == tenant.organisation_id,
    ).order_by(Applicant.created_at.desc()).first()
    if not applicant:
        return None
    return {
        "status": applicant.status,
        "created_at": applicant.created_at.isoformat() if applicant.created_at else None,
        "updated_at": applicant.updated_at.isoformat() if applicant.updated_at else None,
    }


# ── Notification preferences ──────────────────────────────────────────────────

import secrets as _secrets
from pydantic import BaseModel as _NotifBM

class NotifPrefsIn(_NotifBM):
    notify_email: bool = False
    notify_whatsapp: bool = False
    notify_telegram: bool = False
    whatsapp_number: str = ""

@router.get("/portal/notification-prefs")
def get_tenant_notif_prefs(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    # Generate a link code if not already set
    if not tenant.telegram_link_code:
        tenant.telegram_link_code = _secrets.token_hex(4).upper()
        db.commit()
    return {
        "notify_email": tenant.notify_email or False,
        "notify_whatsapp": tenant.notify_whatsapp or False,
        "notify_telegram": tenant.notify_telegram or False,
        "whatsapp_number": tenant.whatsapp_number or "",
        "telegram_chat_id": tenant.telegram_chat_id or "",
        "telegram_link_code": tenant.telegram_link_code or "",
        "telegram_linked": bool(tenant.telegram_chat_id),
    }

@router.put("/portal/notification-prefs")
def save_tenant_notif_prefs(data: NotifPrefsIn, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    tenant.notify_email = data.notify_email
    tenant.notify_whatsapp = data.notify_whatsapp
    tenant.notify_telegram = data.notify_telegram
    if data.whatsapp_number:
        tenant.whatsapp_number = data.whatsapp_number.strip()
    db.commit()
    return {"ok": True}


# ── AI chat ───────────────────────────────────────────────────────────────────

from pydantic import BaseModel as _AIBM
from typing import List as _List

class _PortalMsg(_AIBM):
    role: str
    content: str

class _PortalChatReq(_AIBM):
    messages: _List[_PortalMsg]

@router.post("/portal/ai-chat")
def tenant_ai_chat(req: _PortalChatReq, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    from app.routers.ai import _portal_chat_with_tools, _tenant_context
    from app import wendy as _wendy
    from app.models.tenant_message import TenantMessage

    def _send_message(body: str) -> dict:
        msg = TenantMessage(
            organisation_id=tenant.organisation_id,
            tenant_id=tenant.id,
            sender_type="tenant",
            sender_name=tenant.full_name,
            body=body.strip(),
            read=False,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return {"sent": True, "message_id": msg.id}

    tools = [{
        "type": "function",
        "function": {
            "name": "send_message_to_agent",
            "description": "Send a message to the letting agent on behalf of the tenant.",
            "parameters": {
                "type": "object",
                "properties": {"body": {"type": "string", "description": "The full message text to send"}},
                "required": ["body"]
            }
        }
    }]
    context = _tenant_context(tenant, db)
    msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    return _portal_chat_with_tools(msgs, _wendy.get('mendy_tenant'), context, tools, {"send_message_to_agent": _send_message})


@router.get("/portal/features")
def get_tenant_features(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    from app import feature_flags as ff
    return ff.get_org_features(db, tenant.organisation_id, prefix="tenant_")


# ── Move-out checklist ────────────────────────────────────────────────────────

@router.get("/portal/moveout")
def get_moveout_checklist(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Return checked state for each move-out checklist item (by index)."""
    from app.models.tenant_moveout_check import TenantMoveOutCheck
    rows = db.query(TenantMoveOutCheck).filter_by(tenant_id=tenant.id).all()
    return {r.item_index: r.checked for r in rows}


@router.post("/portal/moveout/{item_index}/toggle")
def toggle_moveout_item(item_index: int, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Toggle a single move-out checklist item."""
    from app.models.tenant_moveout_check import TenantMoveOutCheck
    from datetime import datetime, timezone
    row = db.query(TenantMoveOutCheck).filter_by(tenant_id=tenant.id, item_index=item_index).first()
    if row:
        row.checked = not row.checked
        row.checked_at = datetime.now(timezone.utc) if row.checked else None
    else:
        row = TenantMoveOutCheck(tenant_id=tenant.id, item_index=item_index, checked=True,
                                  checked_at=datetime.now(timezone.utc))
        db.add(row)
    db.commit()
    return {"item_index": item_index, "checked": row.checked}
