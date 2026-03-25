from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional
from datetime import date

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token
from app.models.contractor import Contractor
from app.models.maintenance import MaintenanceRequest
from app.models.unit import Unit
from app.models.property import Property
from app.models.user import User
from app.auth import get_current_user
from app.schemas.auth import Token
from app.config import settings
from app import notifications
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


# --- Jobs ---

def _job_out(j: MaintenanceRequest) -> dict:
    unit = j.unit
    prop = unit.property if unit else None
    return {
        "id": j.id,
        "title": j.title,
        "description": j.description,
        "priority": j.priority,
        "status": j.status,
        "property": prop.name if prop else "—",
        "address": f"{prop.address_line1}, {prop.city}" if prop else "—",
        "unit": unit.name if unit else "—",
        "estimated_cost": j.estimated_cost,
        "actual_cost": j.actual_cost,
        "invoice_ref": j.invoice_ref,
        "created_at": j.created_at.isoformat() if j.created_at else None,
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
    return [_job_out(j) for j in jobs]


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

    allowed_statuses = {"in_progress", "completed", "cancelled"}
    if data.status and data.status in allowed_statuses:
        job.status = data.status
    if data.actual_cost is not None:
        job.actual_cost = data.actual_cost
    if data.invoice_ref is not None:
        job.invoice_ref = data.invoice_ref
    if data.completion_notes is not None:
        # Append to description so agent can see it
        existing = job.description or ""
        job.description = existing + f"\n\n[Contractor update]: {data.completion_notes}"

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


# --- Agent: enable portal for a contractor ---

class PortalEnable(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


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
