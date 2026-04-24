from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.payment import RentPayment
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.models.tenant import Tenant
from app.models.compliance import ComplianceCertificate
from app.models.maintenance import MaintenanceRequest
from app import notifications

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertSettings(BaseModel):
    telegram_chat_id: Optional[str] = None


@router.post("/test")
def send_test_alert(current_user: User = Depends(get_current_user)):
    """Send a test Telegram message to verify the connection."""
    ok = notifications.send(
        f"✅ <b>PropAIrty connected!</b>\n\n"
        f"Hi! Your PropAIrty alerts are working.\n"
        f"You'll be notified here for:\n"
        f"• 💷 Overdue rent payments\n"
        f"• 📋 Expiring compliance certs\n"
        f"• 🔧 Urgent maintenance requests"
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send — check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID")
    return {"ok": True, "message": "Test alert sent"}


@router.post("/run-checks")
def run_checks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually trigger all daily checks now."""
    notifications.run_daily_checks(db)
    return {"ok": True, "message": "Checks run — alerts sent if issues found"}


@router.get("/current-issues")
def current_issues(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return a live snapshot of current issues for the agent's org."""
    org_id = current_user.organisation_id

    # Overdue / partial rent payments
    overdue_payments = (
        db.query(RentPayment)
        .join(Lease).join(Unit).join(Property)
        .filter(RentPayment.status.in_(["overdue", "partial"]), Property.organisation_id == org_id)
        .order_by(RentPayment.due_date)
        .all()
    )
    arrears = []
    for p in overdue_payments:
        lease = db.query(Lease).filter(Lease.id == p.lease_id).first()
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first() if lease else None
        owed = round(p.amount_due - (p.amount_paid or 0), 2)
        arrears.append({
            "tenant": tenant.full_name if tenant else "Unknown",
            "property": f"{unit.property.name} · {unit.name}" if unit else "Unknown",
            "due_date": p.due_date.isoformat() if p.due_date else None,
            "days_overdue": (date.today() - p.due_date).days if p.due_date else 0,
            "owed": owed,
            "status": p.status,
        })

    # Expiring / expired compliance certs (within 30 days)
    today = date.today()
    warn_date = today + timedelta(days=30)
    expiring_certs = (
        db.query(ComplianceCertificate)
        .join(Property)
        .filter(
            Property.organisation_id == org_id,
            ComplianceCertificate.expiry_date <= warn_date,
        )
        .order_by(ComplianceCertificate.expiry_date)
        .all()
    )
    certs = []
    for c in expiring_certs:
        prop = db.query(Property).filter(Property.id == c.property_id).first()
        days_left = (c.expiry_date - today).days if c.expiry_date else 0
        certs.append({
            "property": prop.name if prop else "Unknown",
            "cert_type": c.cert_type,
            "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
            "days_left": days_left,
            "expired": days_left < 0,
        })

    # Open urgent / high maintenance
    urgent_maintenance = (
        db.query(MaintenanceRequest)
        .join(Unit).join(Property)
        .filter(
            Property.organisation_id == org_id,
            MaintenanceRequest.status.in_(["open", "in_progress"]),
            MaintenanceRequest.priority.in_(["high", "urgent"]),
        )
        .order_by(MaintenanceRequest.created_at.desc())
        .all()
    )
    maintenance = []
    for r in urgent_maintenance:
        unit = db.query(Unit).join(Property).filter(Unit.id == r.unit_id).first()
        maintenance.append({
            "id": r.id,
            "title": r.title,
            "priority": r.priority,
            "status": r.status,
            "property": f"{unit.property.name} · {unit.name}" if unit else "Unknown",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "arrears": arrears,
        "expiring_certs": certs,
        "urgent_maintenance": maintenance,
        "total_issues": len(arrears) + len(certs) + len(maintenance),
    }
