from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date, timedelta
import calendar

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.payment import RentPayment
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.models.tenant import Tenant
from app.models.organisation import Organisation
from app.schemas.payment import PaymentOut, MarkPaidRequest
from app import emails

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _org_leases(db: Session, org_id: int):
    return db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Lease.status == "active"
    ).all()


def _ensure_payments_generated(db: Session, org_id: int):
    """Generate pending payment records for active leases for the current + next month."""
    today = date.today()
    months = [(today.year, today.month)]
    if today.month == 12:
        months.append((today.year + 1, 1))
    else:
        months.append((today.year, today.month + 1))

    for lease in _org_leases(db, org_id):
        for year, month in months:
            last_day = calendar.monthrange(year, month)[1]
            due_day = min(lease.rent_day, last_day)
            due_date = date(year, month, due_day)

            # Skip if before lease start
            if due_date < lease.start_date:
                continue
            # Skip if after lease end
            if lease.end_date and due_date > lease.end_date:
                continue

            exists = db.query(RentPayment).filter(
                RentPayment.lease_id == lease.id,
                RentPayment.due_date == due_date
            ).first()
            if not exists:
                db.add(RentPayment(
                    lease_id=lease.id,
                    due_date=due_date,
                    amount_due=lease.monthly_rent,
                    status="pending"
                ))
    db.commit()

    # Mark overdue — fetch IDs first, then update without joins
    overdue_ids = [
        row.id for row in
        db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
            Property.organisation_id == org_id,
            RentPayment.status == "pending",
            RentPayment.due_date < today
        ).all()
    ]
    if overdue_ids:
        db.query(RentPayment).filter(RentPayment.id.in_(overdue_ids)).update(
            {"status": "overdue"}, synchronize_session=False
        )
    db.commit()


def _enrich(payments: list, db: Session) -> list:
    """Add tenant and unit info to payment records. Uses pre-loaded relationships."""
    result = []
    for p in payments:
        lease = p.lease
        tenant = lease.tenant if lease else None
        unit = lease.unit if lease else None
        prop = unit.property if unit else None
        result.append({
            "id": p.id,
            "lease_id": p.lease_id,
            "due_date": str(p.due_date),
            "amount_due": p.amount_due,
            "amount_paid": p.amount_paid,
            "paid_date": str(p.paid_date) if p.paid_date else None,
            "status": p.status,
            "notes": p.notes,
            "tenant_id": tenant.id if tenant else None,
            "tenant_name": tenant.full_name if tenant else "Unknown",
            "tenant_phone": tenant.phone if tenant else None,
            "unit": f"{prop.name} · {unit.name}" if prop and unit else "Unknown",
            "unit_id": unit.id if unit else None,
            "property_id": prop.id if prop else None,
        })
    return result


@router.get("")
def list_payments(month: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_payments_generated(db, current_user.organisation_id)

    today = date.today()
    if month:
        year, m = map(int, month.split("-"))
    else:
        year, m = today.year, today.month

    first = date(year, m, 1)
    last = date(year, m, calendar.monthrange(year, m)[1])

    payments = db.query(RentPayment).join(Lease).join(Unit).join(Property).options(
        joinedload(RentPayment.lease).joinedload(Lease.tenant),
        joinedload(RentPayment.lease).joinedload(Lease.unit).joinedload(Unit.property),
    ).filter(
        Property.organisation_id == current_user.organisation_id,
        RentPayment.due_date >= first,
        RentPayment.due_date <= last
    ).order_by(RentPayment.due_date).all()

    return _enrich(payments, db)


@router.get("/arrears")
def list_arrears(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_payments_generated(db, current_user.organisation_id)

    payments = db.query(RentPayment).join(Lease).join(Unit).join(Property).options(
        joinedload(RentPayment.lease).joinedload(Lease.tenant),
        joinedload(RentPayment.lease).joinedload(Lease.unit).joinedload(Unit.property),
    ).filter(
        Property.organisation_id == current_user.organisation_id,
        RentPayment.status.in_(["overdue", "partial"])
    ).order_by(RentPayment.due_date).all()

    enriched = _enrich(payments, db)
    total_owed = sum(
        (p["amount_due"] - (p["amount_paid"] or 0)) for p in enriched
    )
    return {"payments": enriched, "total_owed": round(total_owed, 2), "count": len(enriched)}


@router.post("/{payment_id}/mark-paid")
def mark_paid(payment_id: int, data: MarkPaidRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    payment = db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
        RentPayment.id == payment_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment.amount_paid = data.amount_paid
    payment.paid_date = data.paid_date
    payment.notes = data.notes
    if data.amount_paid >= payment.amount_due:
        payment.status = "paid"
    else:
        payment.status = "partial"
    db.commit()
    return {"ok": True, "status": payment.status}


@router.post("/{payment_id}/send-reminder")
def send_reminder(payment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    payment = db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
        RentPayment.id == payment_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    lease = payment.lease
    unit = db.query(Unit).get(lease.unit_id)
    prop = db.query(Property).get(unit.property_id)
    tenant = db.query(Tenant).get(lease.tenant_id)
    org = db.query(Organisation).get(current_user.organisation_id)

    from datetime import date
    days = (payment.due_date - date.today()).days
    emails.send_rent_reminder(tenant, payment, lease, unit, prop, org, days)
    return {"ok": True}
