from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.deposit import TenancyDeposit
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.models.tenant import Tenant
from app import notifications

router = APIRouter(prefix="/api/deposits", tags=["deposits"])

PROTECTION_DEADLINE_DAYS = 30
PI_DEADLINE_DAYS = 30


def _deposit_out(d: TenancyDeposit, db: Session):
    lease = d.lease
    unit = lease.unit if lease else None
    prop = unit.property if unit else None
    tenant = lease.tenant if lease else None

    today = date.today()
    days_to_protect = None
    days_to_pi = None
    protection_overdue = False
    pi_overdue = False

    if d.status == "unprotected" and d.received_date:
        deadline = d.received_date + timedelta(days=PROTECTION_DEADLINE_DAYS)
        days_to_protect = (deadline - today).days
        protection_overdue = days_to_protect < 0

    if d.status == "protected" and d.protected_date:
        deadline = d.protected_date + timedelta(days=PI_DEADLINE_DAYS)
        days_to_pi = (deadline - today).days
        pi_overdue = days_to_pi < 0

    return {
        "id": d.id,
        "lease_id": d.lease_id,
        "amount": d.amount,
        "scheme": d.scheme,
        "scheme_reference": d.scheme_reference,
        "received_date": d.received_date.isoformat() if d.received_date else None,
        "protected_date": d.protected_date.isoformat() if d.protected_date else None,
        "prescribed_info_date": d.prescribed_info_date.isoformat() if d.prescribed_info_date else None,
        "status": d.status,
        "return_amount": d.return_amount,
        "deductions": d.deductions,
        "deduction_reason": d.deduction_reason,
        "returned_date": d.returned_date.isoformat() if d.returned_date else None,
        "dispute_notes": d.dispute_notes,
        "notes": d.notes,
        # Computed
        "tenant_name": tenant.full_name if tenant else None,
        "tenant_email": tenant.email if tenant else None,
        "tenant_phone": tenant.phone if tenant else None,
        "unit": f"{prop.name} · {unit.name}" if prop and unit else None,
        "property_name": prop.name if prop else None,
        "lease_start": lease.start_date.isoformat() if lease and lease.start_date else None,
        "lease_status": lease.status if lease else None,
        "days_to_protect": days_to_protect,
        "days_to_pi": days_to_pi,
        "protection_overdue": protection_overdue,
        "pi_overdue": pi_overdue,
    }


class DepositCreate(BaseModel):
    lease_id: int
    amount: float
    received_date: date
    scheme: Optional[str] = None
    scheme_reference: Optional[str] = None
    notes: Optional[str] = None


class DepositUpdate(BaseModel):
    scheme: Optional[str] = None
    scheme_reference: Optional[str] = None
    protected_date: Optional[date] = None
    prescribed_info_date: Optional[date] = None
    status: Optional[str] = None
    return_amount: Optional[float] = None
    deductions: Optional[float] = None
    deduction_reason: Optional[str] = None
    returned_date: Optional[date] = None
    dispute_notes: Optional[str] = None
    notes: Optional[str] = None


@router.get("/leases-for-deposit")
def leases_for_deposit(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return active leases without an existing deposit record, for the Add modal."""
    existing_lease_ids = {d.lease_id for d in db.query(TenancyDeposit).filter(
        TenancyDeposit.organisation_id == current_user.organisation_id
    ).all()}
    leases = (
        db.query(Lease).join(Unit).join(Property)
        .options(
            joinedload(Lease.tenant),
            joinedload(Lease.unit).joinedload(Unit.property),
        )
        .filter(Property.organisation_id == current_user.organisation_id)
        .all()
    )
    result = []
    for l in leases:
        unit = l.unit
        prop = unit.property if unit else None
        tenant = l.tenant
        result.append({
            "id": l.id,
            "tenant_name": tenant.full_name if tenant else "Unknown",
            "unit_name": f"{prop.name} · {unit.name}" if prop and unit else "Unknown",
            "status": l.status,
            "has_deposit": l.id in existing_lease_ids,
        })
    return result


@router.get("")
def list_deposits(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deposits = (
        db.query(TenancyDeposit)
        .options(
            joinedload(TenancyDeposit.lease).joinedload(Lease.tenant),
            joinedload(TenancyDeposit.lease).joinedload(Lease.unit).joinedload(Unit.property),
        )
        .filter(TenancyDeposit.organisation_id == current_user.organisation_id)
        .order_by(TenancyDeposit.received_date.desc())
        .all()
    )
    return [_deposit_out(d, db) for d in deposits]


@router.get("/compliance")
def deposit_compliance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deposits = db.query(TenancyDeposit).filter(
        TenancyDeposit.organisation_id == current_user.organisation_id
    ).all()
    today = date.today()
    unprotected = 0
    protection_overdue = 0
    pi_outstanding = 0
    pi_overdue = 0
    returns_pending = 0
    total_held = 0.0

    for d in deposits:
        if d.status in ("unprotected", "protected", "pi_served"):
            total_held += d.amount or 0

        if d.status == "unprotected":
            unprotected += 1
            if d.received_date and (today - d.received_date).days > PROTECTION_DEADLINE_DAYS:
                protection_overdue += 1

        if d.status == "protected":
            pi_outstanding += 1
            if d.protected_date and (today - d.protected_date).days > PI_DEADLINE_DAYS:
                pi_overdue += 1

        if d.status == "pi_served" and d.lease and d.lease.status != "active":
            returns_pending += 1

    return {
        "total_held": total_held,
        "total_count": len(deposits),
        "unprotected": unprotected,
        "protection_overdue": protection_overdue,
        "pi_outstanding": pi_outstanding,
        "pi_overdue": pi_overdue,
        "returns_pending": returns_pending,
    }


@router.post("")
def create_deposit(data: DepositCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify lease belongs to org
    lease = (
        db.query(Lease).join(Unit).join(Property)
        .filter(Lease.id == data.lease_id, Property.organisation_id == current_user.organisation_id)
        .first()
    )
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")

    existing = db.query(TenancyDeposit).filter(TenancyDeposit.lease_id == data.lease_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Deposit record already exists for this lease")

    deposit = TenancyDeposit(
        organisation_id=current_user.organisation_id,
        lease_id=data.lease_id,
        amount=data.amount,
        received_date=data.received_date,
        scheme=data.scheme,
        scheme_reference=data.scheme_reference,
        notes=data.notes,
        status="unprotected",
    )
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return _deposit_out(deposit, db)


@router.put("/{deposit_id}")
def update_deposit(
    deposit_id: int,
    data: DepositUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deposit = db.query(TenancyDeposit).filter(
        TenancyDeposit.id == deposit_id,
        TenancyDeposit.organisation_id == current_user.organisation_id,
    ).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(deposit, field, value)

    # Auto-advance status based on fields set
    if data.protected_date and deposit.status == "unprotected":
        deposit.status = "protected"
    if data.prescribed_info_date and deposit.status == "protected":
        deposit.status = "pi_served"
    if data.returned_date and deposit.status in ("pi_served", "protected"):
        deposit.status = "returned"

    db.commit()
    db.refresh(deposit)

    # Telegram alert when deposit returned
    if data.returned_date:
        out = _deposit_out(deposit, db)
        notifications.send(
            f"✅ <b>Deposit Returned</b>\n\n"
            f"Tenant: {out['tenant_name']}\n"
            f"Property: {out['unit']}\n"
            f"Amount returned: £{deposit.return_amount or deposit.amount:.2f}"
            + (f"\nDeductions: £{deposit.deductions:.2f} — {deposit.deduction_reason}" if deposit.deductions else "")
        )

    return _deposit_out(deposit, db)


@router.delete("/{deposit_id}")
def delete_deposit(
    deposit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deposit = db.query(TenancyDeposit).filter(
        TenancyDeposit.id == deposit_id,
        TenancyDeposit.organisation_id == current_user.organisation_id,
    ).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    db.delete(deposit)
    db.commit()
    return {"ok": True}


# --- Daily compliance check (called from scheduler) ---

def check_deposit_compliance(db: Session):
    """Send Telegram alerts for overdue deposit protection and PI deadlines."""
    today = date.today()
    deposits = db.query(TenancyDeposit).all()
    for d in deposits:
        lease = d.lease
        unit = lease.unit if lease else None
        prop = unit.property if unit else None
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
        label = f"{prop.name} · {unit.name}" if prop and unit else "Unknown"
        tenant_name = tenant.full_name if tenant else "Unknown tenant"

        if d.status == "unprotected" and d.received_date:
            days_held = (today - d.received_date).days
            if days_held == PROTECTION_DEADLINE_DAYS:
                notifications.send(
                    f"⚠️ <b>Deposit Protection Due Today</b>\n\n"
                    f"Tenant: {tenant_name}\n"
                    f"Property: {label}\n"
                    f"Amount: £{d.amount:.2f}\n"
                    f"Register with TDS, DPS, or MyDeposits <b>today</b> to comply with the law."
                )
            elif days_held > PROTECTION_DEADLINE_DAYS and days_held % 7 == 0:
                notifications.send(
                    f"🚨 <b>Deposit Protection OVERDUE</b>\n\n"
                    f"Tenant: {tenant_name}\n"
                    f"Property: {label}\n"
                    f"Amount: £{d.amount:.2f}\n"
                    f"Overdue by {days_held - PROTECTION_DEADLINE_DAYS} days — legal risk!"
                )

        if d.status == "protected" and d.protected_date:
            days_since = (today - d.protected_date).days
            if days_since == PI_DEADLINE_DAYS:
                notifications.send(
                    f"⚠️ <b>Prescribed Information Due Today</b>\n\n"
                    f"Tenant: {tenant_name}\n"
                    f"Property: {label}\n"
                    f"Serve Prescribed Information to tenant <b>today</b> to comply with the law."
                )
            elif days_since > PI_DEADLINE_DAYS and days_since % 7 == 0:
                notifications.send(
                    f"🚨 <b>Prescribed Information OVERDUE</b>\n\n"
                    f"Tenant: {tenant_name}\n"
                    f"Property: {label}\n"
                    f"Overdue by {days_since - PI_DEADLINE_DAYS} days — legal risk!"
                )
