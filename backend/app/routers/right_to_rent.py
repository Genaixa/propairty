"""
Right to Rent tracker — UK legal requirement to check tenant immigration status.
Tracks check dates, document expiry, and flags when re-checks are due.
Penalty for non-compliance: up to £20,000 per tenant.
"""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/rtr", tags=["right-to-rent"])

RTR_DOCS = [
    "british_passport",
    "uk_passport",
    "euss_settled",
    "euss_pre_settled",
    "brp",
    "visa",
    "other",
]

WARNING_DAYS = 28   # flag if expiry within 28 days


class RTRUpdate(BaseModel):
    rtr_document_type: str
    rtr_check_date: date
    rtr_expiry_date: date | None = None   # None = no time limit


def _rtr_status(tenant: Tenant) -> dict:
    today = date.today()
    if not tenant.rtr_check_date:
        return {"status": "not_checked", "label": "Not checked", "color": "red"}

    # No expiry = British citizen / ILR / settled status — no re-check needed
    if not tenant.rtr_expiry_date:
        return {"status": "valid_indefinite", "label": "Valid (no expiry)", "color": "green"}

    days_left = (tenant.rtr_expiry_date - today).days
    if days_left < 0:
        return {"status": "expired", "label": f"Expired {abs(days_left)}d ago", "color": "red"}
    if days_left <= WARNING_DAYS:
        return {"status": "expiring_soon", "label": f"Expires in {days_left}d", "color": "amber"}
    return {"status": "valid", "label": f"Valid ({days_left}d remaining)", "color": "green"}


@router.get("")
def list_rtr(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """All tenants with their Right to Rent status."""
    tenants = db.query(Tenant).filter(
        Tenant.organisation_id == current_user.organisation_id
    ).all()

    result = []
    for t in tenants:
        status = _rtr_status(t)
        result.append({
            "tenant_id": t.id,
            "full_name": t.full_name,
            "email": t.email,
            "rtr_document_type": t.rtr_document_type,
            "rtr_check_date": t.rtr_check_date.isoformat() if t.rtr_check_date else None,
            "rtr_expiry_date": t.rtr_expiry_date.isoformat() if t.rtr_expiry_date else None,
            **status,
        })

    # Sort: expired first, then expiring, then not checked, then valid
    order = {"expired": 0, "expiring_soon": 1, "not_checked": 2, "valid": 3, "valid_indefinite": 4}
    result.sort(key=lambda x: order.get(x["status"], 5))
    return result


@router.put("/{tenant_id}")
def update_rtr(
    tenant_id: int,
    req: RTRUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.organisation_id == current_user.organisation_id,
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.rtr_document_type = req.rtr_document_type
    tenant.rtr_check_date = req.rtr_check_date
    tenant.rtr_expiry_date = req.rtr_expiry_date
    db.commit()
    db.refresh(tenant)
    return {**_rtr_status(tenant), "tenant_id": tenant.id}


@router.get("/alerts")
def rtr_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Tenants requiring immediate attention."""
    tenants = db.query(Tenant).filter(
        Tenant.organisation_id == current_user.organisation_id
    ).all()
    alerts = []
    for t in tenants:
        s = _rtr_status(t)
        if s["status"] in ("expired", "expiring_soon", "not_checked"):
            alerts.append({"tenant_id": t.id, "full_name": t.full_name, **s})
    return alerts
