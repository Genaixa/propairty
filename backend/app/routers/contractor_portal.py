from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional, List
from datetime import date
import os, uuid, mimetypes

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token
from app.models.contractor import Contractor
from app.models.maintenance import MaintenanceRequest
from app.models.maintenance_note import MaintenanceNote
from app.models.unit import Unit
from app.models.property import Property
from app.models.user import User
from app.models.lease import Lease
from app.models.tenant import Tenant
from app.auth import get_current_user
from app.schemas.auth import Token
from app.config import settings
from app import notifications
from app import password_reset as pr
from jose import JWTError, jwt

router = APIRouter(prefix="/api/contractor", tags=["contractor-portal"])
limiter = Limiter(key_func=get_remote_address)

contractor_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/contractor/token")


def get_current_contractor(token: str = Depends(contractor_oauth2), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "contractor":
            raise ValueError("not a contractor token")
        contractor_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    contractor = db.query(Contractor).filter(
        Contractor.id == contractor_id,
        Contractor.portal_enabled == True,
        Contractor.is_active == True,
    ).first()
    if not contractor:
        raise HTTPException(status_code=401, detail="Portal access not enabled")
    return contractor


# --- Auth ---

@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
def contractor_login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    contractor = db.query(Contractor).filter(
        Contractor.email == form_data.username,
        Contractor.portal_enabled == True,
        Contractor.is_active == True,
    ).first()
    if not contractor or not contractor.hashed_password or not verify_password(form_data.password, contractor.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    from datetime import datetime, timezone
    contractor.last_login = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token({"sub": str(contractor.id), "type": "contractor"})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def contractor_me(contractor: Contractor = Depends(get_current_contractor)):
    return {
        "id": contractor.id,
        "full_name": contractor.full_name,
        "company_name": contractor.company_name,
        "trade": contractor.trade,
        "email": contractor.email,
        "phone": contractor.phone,
    }


class ContractorMeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


@router.patch("/me")
def update_contractor_me(data: ContractorMeUpdate, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    if data.full_name is not None:
        contractor.full_name = data.full_name.strip()
    if data.phone is not None:
        contractor.phone = data.phone.strip()
    db.commit()
    return {"id": contractor.id, "full_name": contractor.full_name, "email": contractor.email, "phone": contractor.phone, "company_name": contractor.company_name, "trade": contractor.trade}


class ContractorPasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/me/change-password")
def contractor_change_password(data: ContractorPasswordChange, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, contractor.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    contractor.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


@router.post("/forgot-password")
@limiter.limit("5/minute")
def contractor_forgot(request: Request, req: pr.ForgotRequest, db: Session = Depends(get_db)):
    contractor = db.query(Contractor).filter(Contractor.email == req.email, Contractor.portal_enabled == True).first()
    return pr.request_reset(req.email, "contractor", contractor.id if contractor else None, db)


@router.post("/reset-password")
def contractor_reset(req: pr.ResetRequest, db: Session = Depends(get_db)):
    return pr.do_reset(req.token, req.new_password, "contractor",
                       lambda uid, d: d.query(Contractor).filter(Contractor.id == uid).first(), db)


# --- Jobs ---

def _job_out(j: MaintenanceRequest, db=None) -> dict:
    unit = j.unit
    prop = unit.property if unit else None

    # Tenant contact: prefer the tenant who reported it, else active lease on this unit
    tenant_name = None
    tenant_phone = None
    if db is not None:
        t = None
        if j.reported_by_tenant_id:
            t = db.query(Tenant).filter(Tenant.id == j.reported_by_tenant_id).first()
        if not t and unit:
            lease = db.query(Lease).filter(
                Lease.unit_id == unit.id,
                Lease.status == "active",
            ).first()
            if lease:
                t = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        if t:
            tenant_name = t.full_name
            tenant_phone = t.phone

    # Photos: all maintenance photos for this job (tenant + contractor uploaded)
    photos = []
    if db is not None:
        from app.models.upload import UploadedFile
        photos = [
            {"id": p.id, "url": f"/uploads/{p.filename}", "source": p.entity_type}
            for p in db.query(UploadedFile).filter(
                UploadedFile.entity_type.in_(["maintenance", "maintenance_contractor"]),
                UploadedFile.entity_id == j.id,
                UploadedFile.mime_type.like("image/%"),
            ).order_by(UploadedFile.id).all()
        ]

    # Quote + invoice file attachments
    quote_file_url = None; quote_file_name = None
    invoice_file_url = None; invoice_file_name = None
    if db is not None:
        from app.models.upload import UploadedFile as UF
        qf = db.query(UF).filter(UF.entity_type == "maintenance_quote", UF.entity_id == j.id).order_by(UF.id.desc()).first()
        if qf:
            quote_file_url = f"/uploads/{qf.filename}"; quote_file_name = qf.original_name
        inv_f = db.query(UF).filter(UF.entity_type == "maintenance_invoice", UF.entity_id == j.id).order_by(UF.id.desc()).first()
        if inv_f:
            invoice_file_url = f"/uploads/{inv_f.filename}"; invoice_file_name = inv_f.original_name

    return {
        "id": j.id,
        "title": j.title,
        "description": j.description,
        "priority": j.priority,
        "status": j.status,
        "property": prop.name if prop else "—",
        "address": f"{prop.address_line1}, {prop.city}" if prop else "—",
        "unit": unit.name if unit else "—",
        "tenant_name": tenant_name,
        "tenant_phone": tenant_phone,
        "estimated_cost": j.estimated_cost,
        "actual_cost": j.actual_cost,
        "invoice_ref": j.invoice_ref,
        "invoice_paid": j.invoice_paid or False,
        "contractor_accepted": j.contractor_accepted,
        "contractor_quote": j.contractor_quote,
        "quote_status": j.quote_status,
        "quote_file_url": quote_file_url,
        "quote_file_name": quote_file_name,
        "invoice_file_url": invoice_file_url,
        "invoice_file_name": invoice_file_name,
        "scheduled_date": j.scheduled_date.isoformat() if j.scheduled_date else None,
        "proposed_date": j.proposed_date.isoformat() if j.proposed_date else None,
        "proposed_date_status": j.proposed_date_status,
        "photos": photos,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "contractor_viewed_at": j.contractor_viewed_at.isoformat() if j.contractor_viewed_at else None,
    }


@router.get("/jobs")
def contractor_jobs(
    contractor: Contractor = Depends(get_current_contractor),
    db: Session = Depends(get_db),
):
    jobs = (
        db.query(MaintenanceRequest)
        .filter(MaintenanceRequest.contractor_id == contractor.id)
        .order_by(MaintenanceRequest.created_at.desc())
        .all()
    )
    return [_job_out(j, db) for j in jobs]


class JobUpdate(BaseModel):
    status: Optional[str] = None        # in_progress | completed | cancelled
    actual_cost: Optional[float] = None
    invoice_ref: Optional[str] = None
    completion_notes: Optional[str] = None


@router.put("/jobs/{job_id}")
def update_job(
    job_id: int,
    data: JobUpdate,
    contractor: Contractor = Depends(get_current_contractor),
    db: Session = Depends(get_db),
):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.contractor_id == contractor.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    allowed_statuses = {"open", "in_progress", "completed", "cancelled"}
    if data.status and data.status in allowed_statuses:
        if data.status == "completed" and not job.contractor_accepted:
            raise HTTPException(status_code=400, detail="You must accept the job before marking it complete")
        job.status = data.status
    if data.actual_cost is not None:
        job.actual_cost = data.actual_cost
    if data.invoice_ref is not None:
        job.invoice_ref = data.invoice_ref
    if data.status == "completed":
        from datetime import date as _today
        # Clear any pending date negotiation — irrelevant once work is done
        if job.proposed_date_status in ("pending", "agent_proposed"):
            job.proposed_date = None
            job.proposed_date_status = None
        # No agreed date — record today and leave an audit note
        if not job.scheduled_date:
            job.scheduled_date = _today.today()
            note = MaintenanceNote(
                maintenance_request_id=job.id,
                author_type="contractor",
                author_name=contractor.full_name + (f" ({contractor.company_name})" if contractor.company_name else ""),
                body=f"Job marked complete on {_today.today().isoformat()}. No date had been agreed with the agent in advance.",
            )
            db.add(note)
    if data.completion_notes:
        note = MaintenanceNote(
            maintenance_request_id=job.id,
            author_type="contractor",
            author_name=contractor.full_name + (f" ({contractor.company_name})" if contractor.company_name else ""),
            body=data.completion_notes,
        )
        db.add(note)

    db.commit()

    # Notify agent if job completed
    if data.status == "completed":
        unit = job.unit
        prop = unit.property if unit else None
        notifications.send(
            f"✅ <b>Job Completed by Contractor</b>\n\n"
            f"Job: {job.title}\n"
            f"Property: {prop.name if prop else '—'} · {unit.name if unit else '—'}\n"
            f"Contractor: {contractor.full_name}"
            + (f" ({contractor.company_name})" if contractor.company_name else "")
            + (f"\nActual Cost: £{data.actual_cost:.2f}" if data.actual_cost else "")
            + (f"\nInvoice: {data.invoice_ref}" if data.invoice_ref else "")
            + (f"\nNotes: {data.completion_notes}" if data.completion_notes else "")
        )

    return {"ok": True, "status": job.status}


# ── Accept / Decline ──────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/accept")
def accept_job(job_id: int, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id, MaintenanceRequest.contractor_id == contractor.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.contractor_accepted = True
    if job.status == "open":
        job.status = "in_progress"
    db.commit()
    unit = job.unit; prop = unit.property if unit else None
    notifications.send(
        f"✅ <b>Job Accepted</b>\n{job.title}\n{prop.name if prop else ''} · {unit.name if unit else ''}\n"
        f"Contractor: {contractor.full_name}{(' ('+contractor.company_name+')') if contractor.company_name else ''}"
    )
    return {"ok": True}


@router.post("/jobs/{job_id}/decline")
def decline_job(job_id: int, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id, MaintenanceRequest.contractor_id == contractor.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.contractor_accepted = False
    job.contractor_id = None
    job.assigned_to = None
    job.status = "open"
    db.commit()
    unit = job.unit; prop = unit.property if unit else None
    notifications.send(
        f"❌ <b>Job Declined by Contractor</b>\n{job.title}\n{prop.name if prop else ''} · {unit.name if unit else ''}\n"
        f"Contractor: {contractor.full_name}{(' ('+contractor.company_name+')') if contractor.company_name else ''}\n⚠️ Needs reassignment."
    )
    return {"ok": True}


# ── Propose alternative date ──────────────────────────────────────────────────

class ProposeDateIn(BaseModel):
    proposed_date: str  # ISO date string

@router.post("/jobs/{job_id}/propose-date")
def propose_date(job_id: int, data: ProposeDateIn, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    from datetime import date as _d
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id, MaintenanceRequest.contractor_id == contractor.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        job.proposed_date = _d.fromisoformat(data.proposed_date)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {data.proposed_date}")
    job.proposed_date_status = "pending"
    db.commit()
    unit = job.unit; prop = unit.property if unit else None
    note = MaintenanceNote(
        maintenance_request_id=job.id,
        author_type="contractor",
        author_name=contractor.full_name + (f" ({contractor.company_name})" if contractor.company_name else ""),
        body=f"Requested reschedule to {data.proposed_date}.",
    )
    db.add(note); db.commit()
    notifications.send(
        f"📅 <b>Reschedule Requested</b>\n{job.title}\n{prop.name if prop else ''} · {unit.name if unit else ''}\n"
        f"Contractor: {contractor.full_name}\nProposes: {data.proposed_date}"
    )
    return {"ok": True, "proposed_date": data.proposed_date}


@router.post("/jobs/{job_id}/accept-agent-date")
def accept_agent_date(job_id: int, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.contractor_id == contractor.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.proposed_date_status != "agent_proposed":
        raise HTTPException(status_code=400, detail="No agent-proposed date to accept")
    job.scheduled_date = job.proposed_date
    job.proposed_date = None
    job.proposed_date_status = None
    db.commit()
    notifications.send(
        f"✅ <b>Date Confirmed by Contractor</b>\n"
        f"Job: {job.title}\n"
        f"Contractor: {contractor.full_name} accepted the proposed date: {job.scheduled_date.isoformat()}"
    )
    return {"ok": True}


# ── Quote submission ──────────────────────────────────────────────────────────

class QuoteIn(BaseModel):
    amount: float
    notes: Optional[str] = None


@router.post("/jobs/{job_id}/quote")
async def submit_quote(
    job_id: int,
    amount: float = Form(...),
    proposed_date: str = Form(...),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    contractor: Contractor = Depends(get_current_contractor),
    db: Session = Depends(get_db),
):
    from datetime import date as _date
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id, MaintenanceRequest.contractor_id == contractor.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.contractor_quote = amount
    job.quote_status = "pending"
    try:
        job.proposed_date = _date.fromisoformat(proposed_date)
        job.proposed_date_status = "pending"
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid proposed_date format")

    # Save file if provided
    if file and file.filename:
        from app.models.upload import UploadedFile
        ext = os.path.splitext(file.filename)[1].lower() or ".pdf"
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        content = await file.read()
        with open(fpath, "wb") as out:
            out.write(content)
        rec = UploadedFile(
            organisation_id=contractor.organisation_id,
            entity_type="maintenance_quote",
            entity_id=job_id,
            filename=fname,
            original_name=file.filename,
            mime_type=file.content_type or "application/octet-stream",
            file_size=len(content),
        )
        db.add(rec)

    unit = job.unit; prop = unit.property if unit else None
    note_body = (
        f"Quote submitted: £{amount:.2f}\nProposed date: {proposed_date}"
        + (f"\n{notes}" if notes else "")
        + ("\n[Quote document attached]" if file and file.filename else "")
    )
    db.add(MaintenanceNote(
        maintenance_request_id=job.id,
        author_type="contractor",
        author_name=contractor.full_name + (f" ({contractor.company_name})" if contractor.company_name else ""),
        body=note_body,
    ))
    db.commit()
    notifications.send(
        f"💰 <b>Quote Submitted</b>\n{job.title}\n{prop.name if prop else ''} · {unit.name if unit else ''}\n"
        f"Contractor: {contractor.full_name}\nAmount: £{amount:.2f}\nProposed date: {proposed_date}"
        + (f"\nNotes: {notes}" if notes else "")
    )
    return {"ok": True, "quote": amount}


# ── Invoice upload ────────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/invoice")
async def upload_invoice(
    job_id: int,
    file: UploadFile = File(...),
    actual_cost: Optional[float] = Form(None),
    invoice_ref: Optional[str] = Form(None),
    contractor: Contractor = Depends(get_current_contractor),
    db: Session = Depends(get_db),
):
    from app.models.upload import UploadedFile
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id, MaintenanceRequest.contractor_id == contractor.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ext = os.path.splitext(file.filename or "")[1].lower() or ".pdf"
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    content = await file.read()
    with open(fpath, "wb") as out:
        out.write(content)

    # Remove any previous invoice file for this job
    db.query(UploadedFile).filter(
        UploadedFile.entity_type == "maintenance_invoice",
        UploadedFile.entity_id == job_id,
    ).delete()

    rec = UploadedFile(
        organisation_id=contractor.organisation_id,
        entity_type="maintenance_invoice",
        entity_id=job_id,
        filename=fname,
        original_name=file.filename,
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(content),
    )
    db.add(rec)

    if actual_cost is not None:
        job.actual_cost = actual_cost
    if invoice_ref is not None:
        job.invoice_ref = invoice_ref

    unit = job.unit; prop = unit.property if unit else None
    db.add(MaintenanceNote(
        maintenance_request_id=job.id,
        author_type="contractor",
        author_name=contractor.full_name + (f" ({contractor.company_name})" if contractor.company_name else ""),
        body=(
            f"Invoice uploaded: {file.filename}"
            + (f"\nAmount: £{actual_cost:.2f}" if actual_cost else "")
            + (f"\nRef: {invoice_ref}" if invoice_ref else "")
        ),
    ))
    db.commit()
    notifications.send(
        f"🧾 <b>Invoice Uploaded</b>\n{job.title}\n{prop.name if prop else ''} · {unit.name if unit else ''}\n"
        f"Contractor: {contractor.full_name}"
        + (f"\nAmount: £{actual_cost:.2f}" if actual_cost else "")
    )
    return {"ok": True, "filename": fname}


# ── Photo upload ──────────────────────────────────────────────────────────────

UPLOAD_DIR = "/root/propairty/uploads"

@router.post("/jobs/{job_id}/photos")
async def upload_job_photos(
    job_id: int,
    files: List[UploadFile] = File(...),
    contractor: Contractor = Depends(get_current_contractor),
    db: Session = Depends(get_db),
):
    from app.models.upload import UploadedFile
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id, MaintenanceRequest.contractor_id == contractor.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    saved = []
    for f in files:
        ext = os.path.splitext(f.filename or "")[1] or ".jpg"
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        content = await f.read()
        with open(fpath, "wb") as out:
            out.write(content)
        rec = UploadedFile(
            organisation_id=contractor.organisation_id,
            entity_type="maintenance_contractor",
            entity_id=job_id,
            filename=fname,
            original_name=f.filename,
            mime_type=f.content_type or "image/jpeg",
            file_size=len(content),
        )
        db.add(rec)
        saved.append(fname)
    db.commit()
    return {"ok": True, "uploaded": len(saved)}


# ── Profile self-management ───────────────────────────────────────────────────

class ProfileIn(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company_name: Optional[str] = None
    trade: Optional[str] = None
    notes: Optional[str] = None  # certifications / general notes


@router.get("/profile")
def get_profile(contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    return {
        "full_name": contractor.full_name,
        "phone": contractor.phone,
        "email": contractor.email,
        "company_name": contractor.company_name,
        "trade": contractor.trade,
        "notes": contractor.notes,
        "portal_enabled": contractor.portal_enabled,
    }


@router.put("/profile")
def update_profile(data: ProfileIn, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    if data.full_name is not None:
        contractor.full_name = data.full_name.strip()
    if data.phone is not None:
        contractor.phone = data.phone.strip()
    if data.email is not None:
        contractor.email = data.email.strip()
    if data.company_name is not None:
        contractor.company_name = data.company_name.strip()
    if data.trade is not None:
        contractor.trade = data.trade.strip()
    if data.notes is not None:
        contractor.notes = data.notes.strip()
    db.commit()
    return {"ok": True}


class NoteCreate(BaseModel):
    body: str


@router.get("/jobs/{job_id}/notes")
def get_job_notes(
    job_id: int,
    contractor: Contractor = Depends(get_current_contractor),
    db: Session = Depends(get_db),
):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.contractor_id == contractor.id,
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


@router.post("/jobs/{job_id}/notes")
def add_job_note(
    job_id: int,
    data: NoteCreate,
    contractor: Contractor = Depends(get_current_contractor),
    db: Session = Depends(get_db),
):
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.contractor_id == contractor.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    note = MaintenanceNote(
        maintenance_request_id=job_id,
        author_type="contractor",
        author_name=contractor.full_name + (f" ({contractor.company_name})" if contractor.company_name else ""),
        body=data.body,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    # Notify agent of new contractor note
    unit = job.unit
    prop = unit.property if unit else None
    notifications.send(
        f"💬 <b>Contractor Note</b>\n\n"
        f"Job: {job.title}\n"
        f"Property: {prop.name if prop else '—'} · {unit.name if unit else '—'}\n"
        f"From: {contractor.full_name}\n"
        f"Note: {data.body}"
    )

    return {
        "id": note.id,
        "author_type": note.author_type,
        "author_name": note.author_name,
        "body": note.body,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


# --- Agent: enable portal for a contractor ---

class PortalEnable(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


@router.post("/jobs/{job_id}/viewed")
def mark_job_viewed(
    job_id: int,
    contractor: Contractor = Depends(get_current_contractor),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone
    job = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.id == job_id,
        MaintenanceRequest.contractor_id == contractor.id,
    ).first()
    if job and not job.contractor_viewed_at:
        job.contractor_viewed_at = datetime.now(timezone.utc)
        db.commit()
    return {"ok": True}


@router.post("/enable/{contractor_id}")
def enable_contractor_portal(
    contractor_id: int,
    data: PortalEnable,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contractor = db.query(Contractor).filter(
        Contractor.id == contractor_id,
        Contractor.organisation_id == current_user.organisation_id,
    ).first()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    if not contractor.email:
        raise HTTPException(status_code=400, detail="Contractor has no email address")
    conflict = db.query(Contractor).filter(
        Contractor.email == contractor.email,
        Contractor.portal_enabled == True,
        Contractor.id != contractor_id,
        Contractor.organisation_id == current_user.organisation_id,
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="Another contractor with this email already has portal access")
    contractor.portal_enabled = True
    contractor.hashed_password = hash_password(data.password)
    db.commit()
    return {"ok": True, "email": contractor.email}


@router.post("/disable/{contractor_id}")
def disable_contractor_portal(
    contractor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contractor = db.query(Contractor).filter(
        Contractor.id == contractor_id,
        Contractor.organisation_id == current_user.organisation_id,
    ).first()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    contractor.portal_enabled = False
    db.commit()
    return {"ok": True}


# ── Notification preferences ──────────────────────────────────────────────────

import secrets as _secrets_ct
from pydantic import BaseModel as _CTNotifBM

class CTNotifPrefsIn(_CTNotifBM):
    notify_email: bool = False
    notify_whatsapp: bool = False
    notify_telegram: bool = False
    whatsapp_number: str = ""

@router.get("/notification-prefs")
def get_contractor_notif_prefs(contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    if not contractor.telegram_link_code:
        contractor.telegram_link_code = _secrets_ct.token_hex(4).upper()
        db.commit()
    return {
        "notify_email": contractor.notify_email or False,
        "notify_whatsapp": contractor.notify_whatsapp or False,
        "notify_telegram": contractor.notify_telegram or False,
        "whatsapp_number": contractor.whatsapp_number or "",
        "telegram_chat_id": contractor.telegram_chat_id or "",
        "telegram_link_code": contractor.telegram_link_code or "",
        "telegram_linked": bool(contractor.telegram_chat_id),
    }

@router.put("/notification-prefs")
def save_contractor_notif_prefs(data: CTNotifPrefsIn, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    contractor.notify_email = data.notify_email
    contractor.notify_whatsapp = data.notify_whatsapp
    contractor.notify_telegram = data.notify_telegram
    if data.whatsapp_number:
        contractor.whatsapp_number = data.whatsapp_number.strip()
    db.commit()
    return {"ok": True}


# ── AI chat ───────────────────────────────────────────────────────────────────

from pydantic import BaseModel as _AIBM_CT
from typing import List as _List_CT

class _CTPortalMsg(_AIBM_CT):
    role: str
    content: str

class _CTPortalChatReq(_AIBM_CT):
    messages: _List_CT[_CTPortalMsg]

@router.post("/ai-chat")
def contractor_ai_chat(req: _CTPortalChatReq, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    from app.routers.ai import _portal_chat_with_tools, _contractor_context
    from app import wendy as _wendy
    from app.models.contractor_message import ContractorMessage

    def _send_message(body: str) -> dict:
        msg = ContractorMessage(
            organisation_id=contractor.organisation_id,
            contractor_id=contractor.id,
            sender_type="contractor",
            sender_name=contractor.full_name,
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
            "description": "Send a message to the letting agent on behalf of the contractor.",
            "parameters": {
                "type": "object",
                "properties": {"body": {"type": "string", "description": "The full message text to send"}},
                "required": ["body"]
            }
        }
    }]
    context = _contractor_context(contractor, db)
    msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    return _portal_chat_with_tools(msgs, _wendy.get('mendy_contractor'), context, tools, {"send_message_to_agent": _send_message})


# ── Messages (contractor ↔ agent) ─────────────────────────────────────────────

from app.models.contractor_message import ContractorMessage as _CTMsg
from pydantic import BaseModel as _CTMsgBM

class _CTMsgIn(_CTMsgBM):
    body: str

@router.get("/messages/unread-count")
def contractor_messages_unread(contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    count = db.query(_CTMsg).filter(
        _CTMsg.contractor_id == contractor.id,
        _CTMsg.sender_type == "agent",
        _CTMsg.read == False,
    ).count()
    return {"count": count}


@router.get("/messages")
def contractor_get_messages(contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    msgs = db.query(_CTMsg).filter(
        _CTMsg.contractor_id == contractor.id
    ).order_by(_CTMsg.created_at.asc()).all()
    # mark agent messages as read
    for m in msgs:
        if m.sender_type == 'agent' and not m.read:
            m.read = True
    db.commit()
    return [{"id": m.id, "sender_type": m.sender_type, "sender_name": m.sender_name,
             "body": m.body, "created_at": m.created_at.isoformat()} for m in msgs]

@router.post("/messages")
def contractor_send_message(data: _CTMsgIn, contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    if not data.body.strip():
        raise HTTPException(status_code=400, detail="Message body cannot be empty")
    msg = _CTMsg(
        organisation_id=contractor.organisation_id,
        contractor_id=contractor.id,
        sender_type="contractor",
        sender_name=contractor.full_name or contractor.company_name or "Contractor",
        body=data.body.strip(),
        read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "sender_type": msg.sender_type, "sender_name": msg.sender_name,
            "body": msg.body, "created_at": msg.created_at.isoformat()}


@router.get("/features")
def get_contractor_features(contractor: Contractor = Depends(get_current_contractor), db: Session = Depends(get_db)):
    from app import feature_flags as ff
    return ff.get_org_features(db, contractor.organisation_id, prefix="contractor_")
