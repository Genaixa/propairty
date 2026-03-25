from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.contractor import Contractor
from app.models.maintenance import MaintenanceRequest
from app.models.unit import Unit
from app.models.property import Property
from app import emails, notifications

router = APIRouter(prefix="/api/contractors", tags=["contractors"])


class ContractorCreate(BaseModel):
    full_name: str
    company_name: Optional[str] = None
    trade: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class ContractorOut(BaseModel):
    id: int
    full_name: str
    company_name: Optional[str] = None
    trade: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    portal_enabled: bool = False

    class Config:
        from_attributes = True


class AssignContractor(BaseModel):
    contractor_id: Optional[int] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    invoice_ref: Optional[str] = None


@router.get("", response_model=list[ContractorOut])
def list_contractors(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Contractor).filter(
        Contractor.organisation_id == current_user.organisation_id,
        Contractor.is_active == True
    ).order_by(Contractor.full_name).all()


@router.post("", response_model=ContractorOut)
def create_contractor(data: ContractorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contractor = Contractor(organisation_id=current_user.organisation_id, **data.model_dump())
    db.add(contractor)
    db.commit()
    db.refresh(contractor)
    return contractor


@router.put("/{contractor_id}", response_model=ContractorOut)
def update_contractor(contractor_id: int, data: ContractorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Contractor).filter(Contractor.id == contractor_id, Contractor.organisation_id == current_user.organisation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contractor not found")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{contractor_id}")
def delete_contractor(contractor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Contractor).filter(Contractor.id == contractor_id, Contractor.organisation_id == current_user.organisation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contractor not found")
    c.is_active = False
    db.commit()
    return {"ok": True}


@router.put("/assign/{job_id}")
def assign_contractor(job_id: int, data: AssignContractor, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == job_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if data.contractor_id:
        contractor = db.query(Contractor).filter(
            Contractor.id == data.contractor_id,
            Contractor.organisation_id == current_user.organisation_id
        ).first()
        if not contractor:
            raise HTTPException(status_code=404, detail="Contractor not found")
        job.contractor_id = data.contractor_id
        job.assigned_to = contractor.full_name
        if job.status == "open":
            job.status = "in_progress"

    if data.estimated_cost is not None:
        job.estimated_cost = data.estimated_cost
    if data.actual_cost is not None:
        job.actual_cost = data.actual_cost
    if data.invoice_ref is not None:
        job.invoice_ref = data.invoice_ref

    db.commit()
    db.refresh(job)

    # Notify via Telegram
    if data.contractor_id and contractor:
        unit = db.query(Unit).filter(Unit.id == job.unit_id).first()
        unit_name = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
        notifications.send(
            f"🔧 <b>Contractor Assigned</b>\n\n"
            f"Job: {job.title}\n"
            f"Property: {unit_name}\n"
            f"Contractor: {contractor.full_name}"
            + (f" ({contractor.company_name})" if contractor.company_name else "")
            + (f"\nEstimate: £{data.estimated_cost:.0f}" if data.estimated_cost else "")
        )

    return {
        "ok": True,
        "job_id": job.id,
        "contractor": contractor.full_name if data.contractor_id else None,
        "status": job.status,
    }


@router.get("/jobs")
def jobs_by_contractor(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """All maintenance jobs with contractor and cost info."""
    jobs = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).order_by(MaintenanceRequest.created_at.desc()).all()

    return [
        {
            "id": j.id,
            "title": j.title,
            "priority": j.priority,
            "status": j.status,
            "property": j.unit.property.name if j.unit else None,
            "unit": j.unit.name if j.unit else None,
            "contractor_id": j.contractor_id,
            "contractor_name": j.contractor.full_name if j.contractor else None,
            "contractor_company": j.contractor.company_name if j.contractor else None,
            "estimated_cost": j.estimated_cost,
            "actual_cost": j.actual_cost,
            "invoice_ref": j.invoice_ref,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]
