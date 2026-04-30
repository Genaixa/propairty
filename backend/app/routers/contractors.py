from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.contractor import Contractor
from app.models.maintenance import MaintenanceRequest
from app.models.contractor_review import ContractorReview
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
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
    avg_rating: Optional[float] = None
    review_count: int = 0
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class AssignContractor(BaseModel):
    contractor_id: Optional[int] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    invoice_ref: Optional[str] = None


def _rating_summary(contractor_id: int, db: Session) -> dict:
    reviews = db.query(ContractorReview).filter(ContractorReview.contractor_id == contractor_id).all()
    if not reviews:
        return {"avg_rating": None, "review_count": 0}
    avg = round(sum(r.stars for r in reviews) / len(reviews), 1)
    return {"avg_rating": avg, "review_count": len(reviews)}


@router.get("", response_model=list[ContractorOut])
def list_contractors(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contractors = db.query(Contractor).filter(
        Contractor.organisation_id == current_user.organisation_id,
        Contractor.is_active == True
    ).order_by(Contractor.full_name).all()
    result = []
    for c in contractors:
        d = ContractorOut.model_validate(c).model_dump()
        d.update(_rating_summary(c.id, db))
        result.append(d)
    return result


@router.post("", response_model=ContractorOut)
def create_contractor(data: ContractorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contractor = Contractor(organisation_id=current_user.organisation_id, **data.model_dump())
    db.add(contractor)
    db.commit()
    db.refresh(contractor)
    return contractor


@router.get("/{contractor_id}/profile")
def get_contractor_profile(contractor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Full contractor profile: details, jobs, reviews, messages."""
    c = db.query(Contractor).filter(Contractor.id == contractor_id, Contractor.organisation_id == current_user.organisation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contractor not found")

    jobs = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.contractor_id == contractor_id,
        MaintenanceRequest.organisation_id == current_user.organisation_id,
    ).order_by(MaintenanceRequest.created_at.desc()).all()

    jobs_out = []
    for j in jobs:
        unit = db.query(Unit).get(j.unit_id) if j.unit_id else None
        prop = db.query(Property).get(j.property_id) if j.property_id else None
        jobs_out.append({
            "id": j.id,
            "title": j.title,
            "description": j.description,
            "status": j.status,
            "priority": j.priority,
            "property": prop.name if prop else "—",
            "unit": unit.name if unit else "—",
            "estimated_cost": j.estimated_cost,
            "actual_cost": j.actual_cost,
            "invoice_ref": j.invoice_ref,
            "created_at": str(j.created_at)[:10] if j.created_at else None,
        })

    reviews = db.query(ContractorReview).filter(ContractorReview.contractor_id == contractor_id).order_by(ContractorReview.created_at.desc()).all()
    reviews_out = [{"id": r.id, "rating": r.stars, "comment": r.comment, "created_at": str(r.created_at)[:10] if r.created_at else None} for r in reviews]

    rating = _rating_summary(contractor_id, db)

    return {
        "id": c.id,
        "full_name": c.full_name,
        "company_name": c.company_name,
        "contact_name": c.contact_name,
        "trade": c.trade,
        "email": c.email,
        "phone": c.phone,
        "notes": c.notes,
        "avatar_url": c.avatar_url,
        "is_active": c.is_active,
        "portal_enabled": c.portal_enabled,
        "created_at": str(c.created_at)[:10] if c.created_at else None,
        "avg_rating": rating.get("avg_rating"),
        "review_count": rating.get("review_count", 0),
        "jobs": jobs_out,
        "reviews": reviews_out,
    }


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

    if data.contractor_id and contractor:
        unit = db.query(Unit).filter(Unit.id == job.unit_id).first()
        prop = unit.property if unit else None
        unit_name = f"{prop.name} · {unit.name}" if prop and unit else "Unknown"
        org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()

        # Notify agent channel
        notifications.send(
            f"🔧 <b>Contractor Assigned</b>\n\n"
            f"Job: {job.title}\n"
            f"Property: {unit_name}\n"
            f"Contractor: {contractor.full_name}"
            + (f" ({contractor.company_name})" if contractor.company_name else "")
            + (f"\nEstimate: £{data.estimated_cost:.0f}" if data.estimated_cost else "")
        )

        # Notify contractor — Telegram + email
        contractor_name = contractor.full_name or contractor.company_name or "Contractor"
        if contractor.telegram_chat_id:
            notifications.send(
                f"🔧 <b>New Job Assigned to You</b>\n\n"
                f"Job: {job.title}\n"
                f"Location: {unit_name}\n"
                f"Please log in to your portal to accept or decline.",
                chat_id=contractor.telegram_chat_id,
            )
        if contractor.notify_email:
            emails.send_contractor_job_assigned(contractor, job.title, prop.name if prop else "", unit.name if unit else "", org)

        # Notify tenant
        if job.reported_by_tenant_id:
            from app.models.tenant import Tenant
            tenant = db.query(Tenant).filter(Tenant.id == job.reported_by_tenant_id).first()
            if tenant:
                emails.send_tenant_contractor_assigned(tenant, job.title, contractor_name, org)

    return {
        "ok": True,
        "job_id": job.id,
        "contractor": contractor.full_name if data.contractor_id else None,
        "status": job.status,
    }


@router.get("/{contractor_id}/reviews")
def get_contractor_reviews(contractor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contractor = db.query(Contractor).filter(
        Contractor.id == contractor_id,
        Contractor.organisation_id == current_user.organisation_id,
    ).first()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    reviews = db.query(ContractorReview).filter(
        ContractorReview.contractor_id == contractor_id
    ).order_by(ContractorReview.created_at.desc()).all()
    summary = _rating_summary(contractor_id, db)
    return {
        **summary,
        "reviews": [
            {
                "id": r.id,
                "reviewer_type": r.reviewer_type,
                "reviewer_name": r.reviewer_name,
                "stars": r.stars,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "job_id": r.maintenance_request_id,
            }
            for r in reviews
        ],
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


# --- Contractor Messages ---

from app.models.contractor_message import ContractorMessage
from pydantic import BaseModel as _BM

class ContractorMsgCreate(_BM):
    body: str

@router.get("/messages/inbox")
def contractor_messages_inbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """All contractor conversations for this org grouped by contractor, most recent first."""
    msgs = db.query(ContractorMessage).filter(
        ContractorMessage.organisation_id == current_user.organisation_id
    ).order_by(ContractorMessage.created_at.desc()).all()

    seen = {}
    for m in msgs:
        if m.contractor_id not in seen:
            contractor = db.query(Contractor).filter(Contractor.id == m.contractor_id).first()
            seen[m.contractor_id] = {
                "contractor_id": m.contractor_id,
                "contractor_name": contractor.full_name if contractor else "Unknown",
                "contractor_email": contractor.email if contractor else "",
                "last_message": m.body,
                "last_message_at": m.created_at.isoformat() if m.created_at else None,
                "last_sender": m.sender_type,
                "unread": 0,
            }
        if m.sender_type == "contractor" and not m.read:
            seen[m.contractor_id]["unread"] += 1

    return list(seen.values())

@router.get("/{contractor_id}/messages")
def get_contractor_messages(contractor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id, Contractor.organisation_id == current_user.organisation_id).first()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    msgs = db.query(ContractorMessage).filter(
        ContractorMessage.contractor_id == contractor_id
    ).order_by(ContractorMessage.created_at.asc()).all()
    for m in msgs:
        if m.sender_type == "contractor" and not m.read:
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

@router.post("/{contractor_id}/messages")
def send_contractor_message(contractor_id: int, data: ContractorMsgCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id, Contractor.organisation_id == current_user.organisation_id).first()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    msg = ContractorMessage(
        organisation_id=current_user.organisation_id,
        contractor_id=contractor_id,
        sender_type="agent",
        sender_name=current_user.full_name or current_user.email,
        body=data.body.strip(),
        read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    # Notify contractor via their chosen channels
    try:
        from app.models.organisation import Organisation as _Org
        from app import emails as _emails
        org = db.query(_Org).filter(_Org.id == current_user.organisation_id).first()
        _emails.send_portal_message_notification(
            contractor, current_user.full_name or current_user.email,
            data.body.strip(), org,
            "https://propairty.co.uk/contractor/portal"
        )
    except Exception as e:
        print(f"[email] contractor message notify failed: {e}")
    return {
        "id": msg.id,
        "sender_type": msg.sender_type,
        "sender_name": msg.sender_name,
        "body": msg.body,
        "read": msg.read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }
