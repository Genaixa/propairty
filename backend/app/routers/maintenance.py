import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user, get_accessible_property_ids
from app.models.user import User
from app.models.maintenance import MaintenanceRequest
from app.models.maintenance_note import MaintenanceNote
from app.models.maintenance_payment import MaintenancePayment
from app.models.contractor_review import ContractorReview
from app.models.unit import Unit
from app.models.property import Property
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut
from app import notifications, emails, sms, audit
from app.routers import dispatch as dispatch_router
from app.models.tenant import Tenant
from app.models.lease import Lease
from app.models.organisation import Organisation
from app.models.contractor import Contractor
from app.models.dispatch import DispatchQueue
from app.models.upload import UploadedFile

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])

@router.get("")
def list_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    )
    allowed = get_accessible_property_ids(db, current_user)
    if allowed is not None:
        q = q.filter(Property.id.in_(allowed))
    reqs = q.order_by(MaintenanceRequest.created_at.desc()).all()

    result = []
    for r in reqs:
        unit = db.query(Unit).get(r.unit_id)
        prop = db.query(Property).get(unit.property_id) if unit else None
        contractor = db.query(Contractor).get(r.contractor_id) if r.contractor_id else None
        notes = db.query(MaintenanceNote).filter(MaintenanceNote.maintenance_request_id == r.id).all()
        notes_count = len(notes)
        has_tenant_note = any(n.author_type == 'tenant' for n in notes)
        qf = db.query(UploadedFile).filter(
            UploadedFile.entity_type == "maintenance_quote",
            UploadedFile.entity_id == r.id,
        ).order_by(UploadedFile.id.desc()).first()
        inv_f = db.query(UploadedFile).filter(
            UploadedFile.entity_type == "maintenance_invoice",
            UploadedFile.entity_id == r.id,
        ).order_by(UploadedFile.id.desc()).first()
        total_paid = db.query(sqlfunc.coalesce(sqlfunc.sum(MaintenancePayment.amount), 0.0)).filter(
            MaintenancePayment.maintenance_request_id == r.id,
        ).scalar() or 0.0
        result.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "priority": r.priority,
            "status": r.status,
            "reported_by": r.reported_by,
            "reported_by_tenant_id": r.reported_by_tenant_id,
            "assigned_to": r.assigned_to,
            "contractor_id": r.contractor_id,
            "contractor_name": contractor.full_name if contractor else None,
            "contractor_company": contractor.company_name if contractor else None,
            "estimated_cost": r.estimated_cost,
            "actual_cost": r.actual_cost,
            "invoice_ref": r.invoice_ref,
            "invoice_paid": r.invoice_paid or False,
            "total_paid": round(total_paid, 2),
            "contractor_accepted": r.contractor_accepted,
            "contractor_quote": r.contractor_quote,
            "quote_status": r.quote_status,
            "scheduled_date": r.scheduled_date.isoformat() if r.scheduled_date else None,
            "proposed_date": r.proposed_date.isoformat() if r.proposed_date else None,
            "proposed_date_status": r.proposed_date_status,
            "unit_id": r.unit_id,
            "property_id": prop.id if prop else None,
            "unit_name": f"{prop.name} · {unit.name}" if prop and unit else "Unknown",
            "tenant_satisfied": r.tenant_satisfied,
            "tenant_feedback": r.tenant_feedback,
            "created_at": str(r.created_at)[:10],
            "updated_at": str(r.updated_at)[:10] if r.updated_at else None,
            "contractor_viewed_at": r.contractor_viewed_at.isoformat() if r.contractor_viewed_at else None,
            "notes_count": notes_count,
            "has_tenant_note": has_tenant_note,
            "quote_file_url": f"/uploads/{qf.filename}" if qf else None,
            "quote_file_name": qf.original_name if qf else None,
            "invoice_file_url": f"/uploads/{inv_f.filename}" if inv_f else None,
            "invoice_file_name": inv_f.original_name if inv_f else None,
            "ai_triage": json.loads(r.ai_triage) if r.ai_triage else None,
        })
    return result

@router.post("", response_model=MaintenanceOut)
def create_request(data: MaintenanceCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    unit = db.query(Unit).join(Property).filter(
        Unit.id == data.unit_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    req = MaintenanceRequest(
        **data.model_dump(),
        organisation_id=current_user.organisation_id,
        property_id=unit.property_id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    # Instant Telegram alert for new requests
    unit = db.query(Unit).join(Property).filter(Unit.id == req.unit_id).first()
    unit_name = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
    notifications.notify_new_maintenance(req.title, unit_name, req.priority, req.reported_by or "")
    # AI triage and dispatch queue — run in background so response returns immediately
    req_id_snapshot = req.id
    def _bg_enqueue():
        from app.database import SessionLocal
        bg_db = SessionLocal()
        try:
            bg_req = bg_db.query(MaintenanceRequest).get(req_id_snapshot)
            if bg_req:
                dispatch_router.enqueue_job(bg_req, bg_db)
        except Exception as e:
            print(f"[dispatch] enqueue failed: {e}")
        finally:
            bg_db.close()
    background_tasks.add_task(_bg_enqueue)
    return req

@router.delete("/{req_id}")
def delete_request(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    db.query(MaintenanceNote).filter(MaintenanceNote.maintenance_request_id == req_id).delete()
    db.query(ContractorReview).filter(ContractorReview.maintenance_request_id == req_id).delete()
    db.query(DispatchQueue).filter(DispatchQueue.maintenance_request_id == req_id).delete()
    db.query(MaintenancePayment).filter(MaintenancePayment.maintenance_request_id == req_id).delete()
    db.delete(req)
    db.commit()
    return {"ok": True}


@router.put("/{req_id}", response_model=MaintenanceOut)
def update_request(req_id: int, data: MaintenanceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    old_status = req.status
    old_contractor_id = req.contractor_id
    old_reported_by_tenant_id = req.reported_by_tenant_id
    for k, v in data.model_dump().items():
        setattr(req, k, v)
    # Never obliterate reported_by_tenant_id — the agent form doesn't carry this field
    if data.reported_by_tenant_id is None and old_reported_by_tenant_id is not None:
        req.reported_by_tenant_id = old_reported_by_tenant_id
    # Keep assigned_to in sync with contractor_id when contractor changes
    if req.contractor_id != old_contractor_id:
        if req.contractor_id:
            c = db.query(Contractor).filter(Contractor.id == req.contractor_id).first()
            if c and not data.assigned_to:
                req.assigned_to = c.full_name or c.company_name
        else:
            req.assigned_to = None
    db.commit()
    db.refresh(req)
    # Notify tenant if status changed and job was submitted by a tenant
    if req.status != old_status and req.reported_by_tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == req.reported_by_tenant_id).first()
        org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
        if tenant and org:
            emails.send_maintenance_update(tenant, req.title, req.status, org)
            if tenant.phone:
                sms.send_maintenance_update_sms(tenant.full_name, tenant.phone, req.title, req.status)
    # Audit
    audit.log_action(
        db,
        organisation_id=current_user.organisation_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        action="updated",
        entity_type="maintenance",
        entity_id=req.id,
        entity_name=req.title,
        detail=f"Status → {req.status}" if req.status != old_status else None,
    )
    db.commit()
    return req


class NoteCreate(BaseModel):
    body: str


@router.get("/{req_id}/notes")
def get_notes(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    notes = db.query(MaintenanceNote).filter(
        MaintenanceNote.maintenance_request_id == req_id
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


@router.post("/{req_id}/notes")
def add_note(req_id: int, data: NoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    note = MaintenanceNote(
        maintenance_request_id=req_id,
        author_type="agent",
        author_name=current_user.full_name or current_user.email,
        body=data.body,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {
        "id": note.id,
        "author_type": note.author_type,
        "author_name": note.author_name,
        "body": note.body,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


class ReviewCreate(BaseModel):
    stars: int
    comment: Optional[str] = None


@router.post("/{req_id}/review")
def add_review(req_id: int, data: ReviewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not (1 <= data.stars <= 5):
        raise HTTPException(status_code=400, detail="Stars must be 1–5")
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if not req.contractor_id:
        raise HTTPException(status_code=400, detail="No contractor assigned to this job")
    # One agent review per job
    existing = db.query(ContractorReview).filter(
        ContractorReview.maintenance_request_id == req_id,
        ContractorReview.reviewer_type == "agent",
    ).first()
    if existing:
        existing.stars = data.stars
        existing.comment = data.comment
        db.commit()
        return {"ok": True, "updated": True}
    review = ContractorReview(
        contractor_id=req.contractor_id,
        maintenance_request_id=req_id,
        reviewer_type="agent",
        reviewer_name=current_user.full_name or current_user.email,
        stars=data.stars,
        comment=data.comment,
    )
    db.add(review)
    db.commit()
    return {"ok": True, "updated": False}


@router.get("/{req_id}/review")
def get_review(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return existing agent review for a job, if any."""
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    review = db.query(ContractorReview).filter(
        ContractorReview.maintenance_request_id == req_id,
        ContractorReview.reviewer_type == "agent",
    ).first()
    if not review:
        return None
    return {"stars": review.stars, "comment": review.comment}


# ── Quote approve / reject (agent) ────────────────────────────────────────────

class QuoteDecision(BaseModel):
    decision: str  # "approved" | "rejected"

@router.post("/{req_id}/quote-decision")
def quote_decision(req_id: int, data: QuoteDecision, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot change quote decision on a {req.status} job")
    if data.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be approved or rejected")
    if req.contractor_quote is None:
        raise HTTPException(status_code=400, detail="No quote has been submitted by the contractor yet")
    req.quote_status = data.decision
    if data.decision == "approved":
        req.estimated_cost = req.contractor_quote
        # Leave proposed_date intact — agent decides on date separately (step 2)
    db.commit()

    # Notify contractor of quote decision
    if req.contractor_id:
        from app.models.contractor import Contractor
        from app.models.organisation import Organisation
        contractor = db.query(Contractor).filter(Contractor.id == req.contractor_id).first()
        org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
        if contractor:
            label = "approved ✅" if data.decision == "approved" else "rejected ❌"
            if contractor.telegram_chat_id:
                notifications.send(
                    f"📋 <b>Quote {label}</b>\n\nJob: {req.title}\nYour quote has been {data.decision}."
                    + ("\nPlease log in to agree a visit date." if data.decision == "approved" else ""),
                    chat_id=contractor.telegram_chat_id,
                )
            if contractor.notify_email:
                emails.send_contractor_quote_decision(contractor, req.title, data.decision, org)

    return {"ok": True, "quote_status": req.quote_status}


# ── Payments (agent) ──────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    amount: float
    paid_date: str       # ISO date
    ref: Optional[str] = None
    note: Optional[str] = None


def _refresh_invoice_paid(req: MaintenanceRequest, db: Session) -> float:
    total = db.query(sqlfunc.coalesce(sqlfunc.sum(MaintenancePayment.amount), 0.0)).filter(
        MaintenancePayment.maintenance_request_id == req.id,
    ).scalar() or 0.0
    req.invoice_paid = bool(req.actual_cost and total >= req.actual_cost)
    return round(total, 2)


@router.get("/{req_id}/payments")
def get_payments(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    payments = db.query(MaintenancePayment).filter(
        MaintenancePayment.maintenance_request_id == req_id,
    ).order_by(MaintenancePayment.paid_date, MaintenancePayment.id).all()
    return [
        {"id": p.id, "amount": p.amount, "paid_date": str(p.paid_date),
         "ref": p.ref, "note": p.note}
        for p in payments
    ]


@router.post("/{req_id}/payments")
def add_payment(req_id: int, data: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from datetime import date as _d
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    try:
        paid_date = _d.fromisoformat(data.paid_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid paid_date")
    payment = MaintenancePayment(
        maintenance_request_id=req_id,
        amount=data.amount,
        paid_date=paid_date,
        ref=data.ref,
        note=data.note,
        recorded_by=current_user.id,
    )
    db.add(payment)
    db.flush()
    total_paid = _refresh_invoice_paid(req, db)
    db.commit()
    db.refresh(payment)
    return {
        "id": payment.id, "amount": payment.amount, "paid_date": str(payment.paid_date),
        "ref": payment.ref, "note": payment.note,
        "total_paid": total_paid, "invoice_paid": req.invoice_paid,
    }


@router.delete("/{req_id}/payments/{payment_id}")
def delete_payment(req_id: int, payment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    payment = db.query(MaintenancePayment).filter(
        MaintenancePayment.id == payment_id,
        MaintenancePayment.maintenance_request_id == req_id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.flush()
    total_paid = _refresh_invoice_paid(req, db)
    db.commit()
    return {"ok": True, "total_paid": total_paid, "invoice_paid": req.invoice_paid}


@router.post("/{req_id}/mark-paid")
def mark_invoice_paid(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Legacy toggle kept for golem test compatibility."""
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.invoice_paid = not (req.invoice_paid or False)
    db.commit()
    return {"ok": True, "invoice_paid": req.invoice_paid}


# ── Scheduled date (agent) ────────────────────────────────────────────────────

from datetime import date as _date

class ScheduledDateIn(BaseModel):
    scheduled_date: Optional[str] = None  # ISO date string or null

@router.post("/{req_id}/scheduled-date")
def set_scheduled_date(req_id: int, data: ScheduledDateIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from datetime import date as _d
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot reschedule a {req.status} job")
    if data.scheduled_date:
        try:
            req.scheduled_date = _d.fromisoformat(data.scheduled_date)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date: {data.scheduled_date}")
    else:
        req.scheduled_date = None
    db.commit()
    return {"ok": True, "scheduled_date": req.scheduled_date.isoformat() if req.scheduled_date else None}


# ── Proposed date decision (agent) ───────────────────────────────────────────

class ProposedDateDecision(BaseModel):
    decision: str  # "accepted" | "rejected"

@router.post("/{req_id}/proposed-date-decision")
def proposed_date_decision(req_id: int, data: ProposedDateDecision, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from datetime import date as _d
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if data.decision not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be accepted or rejected")
    if not req.proposed_date:
        raise HTTPException(status_code=400, detail="No proposed date from contractor")
    if data.decision == "accepted":
        req.scheduled_date = req.proposed_date
        req.proposed_date = None
        req.proposed_date_status = None
    else:
        req.proposed_date_status = "rejected"
    db.commit()
    return {"ok": True, "scheduled_date": req.scheduled_date.isoformat() if req.scheduled_date else None}


# ── Agent counter-propose date ────────────────────────────────────────────────

class AgentProposeDateIn(BaseModel):
    proposed_date: str  # ISO date

@router.post("/{req_id}/propose-date")
def agent_propose_date(req_id: int, data: AgentProposeDateIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from datetime import date as _d
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    try:
        req.proposed_date = _d.fromisoformat(data.proposed_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    req.proposed_date_status = "agent_proposed"
    req.scheduled_date = None
    db.commit()
    if req.contractor_id:
        contractor = db.query(User).filter(User.id == req.contractor_id).first()
        if contractor and getattr(contractor, "telegram_chat_id", None):
            notifications.send(
                f"📅 <b>New Date Proposed</b>\n"
                f"Job: {req.title}\n"
                f"Agent proposes: {data.proposed_date}\n"
                f"Please accept or propose an alternative in your portal.",
                chat_id=contractor.telegram_chat_id,
            )
    return {"ok": True}
