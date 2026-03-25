from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.notice import LegalNotice
from app.models.lease import Lease
from app.models.tenant import Tenant
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
from app.models.payment import RentPayment
from app.models.compliance import ComplianceCertificate
from app.models.deposit import TenancyDeposit
from app import docgen, notifications

router = APIRouter(prefix="/api/notices", tags=["notices"])


def _get_lease(lease_id: int, org_id: int, db: Session):
    lease = (
        db.query(Lease).join(Unit).join(Property)
        .filter(Lease.id == lease_id, Property.organisation_id == org_id)
        .first()
    )
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
    unit = db.query(Unit).filter(Unit.id == lease.unit_id).first()
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    return lease, tenant, unit, org


def _preflight_checks(lease, db: Session) -> dict:
    """Run S21 pre-flight compliance checks. Returns dict of check: pass|fail|unknown."""
    today = date.today()
    unit = lease.unit
    prop = unit.property if unit else None
    prop_id = prop.id if prop else None

    checks = {
        "gas_cert": "unknown",
        "epc": "unknown",
        "deposit": "unknown",
        "how_to_rent": "unknown",  # cannot auto-verify — user must confirm
        "notice_period": "pass",   # calculated below
        "fixed_term": "pass",
    }

    # Gas Safety Certificate
    if prop_id:
        gas = (
            db.query(ComplianceCertificate)
            .filter(
                ComplianceCertificate.property_id == prop_id,
                ComplianceCertificate.cert_type == "gas_safety",
                ComplianceCertificate.expiry_date >= today,
            )
            .first()
        )
        checks["gas_cert"] = "pass" if gas else "fail"

        # EPC
        epc = (
            db.query(ComplianceCertificate)
            .filter(
                ComplianceCertificate.property_id == prop_id,
                ComplianceCertificate.cert_type == "epc",
                ComplianceCertificate.expiry_date >= today,
            )
            .first()
        )
        checks["epc"] = "pass" if epc else "fail"

    # Deposit protection
    deposit_rec = db.query(TenancyDeposit).filter(TenancyDeposit.lease_id == lease.id).first()
    if not lease.deposit or lease.deposit == 0:
        checks["deposit"] = "n/a"
    elif deposit_rec and deposit_rec.status in ("pi_served", "returned"):
        checks["deposit"] = "pass"
    elif deposit_rec and deposit_rec.status == "protected":
        checks["deposit"] = "warn"  # protected but PI not served
    else:
        checks["deposit"] = "fail"

    # Fixed term check — S21 cannot be served in first 4 months
    if lease.start_date:
        earliest_s21 = lease.start_date + timedelta(days=120)
        if today < earliest_s21:
            checks["fixed_term"] = "fail"

    return checks


def _arrears_for_lease(lease_id: int, db: Session) -> float:
    payments = db.query(RentPayment).filter(
        RentPayment.lease_id == lease_id,
        RentPayment.status.in_(["overdue", "partial"]),
    ).all()
    total = sum((p.amount_due - (p.amount_paid or 0)) for p in payments)
    return round(total, 2)


def _notice_out(n: LegalNotice, db: Session) -> dict:
    lease = n.lease
    unit = lease.unit if lease else None
    prop = unit.property if unit else None
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
    return {
        "id": n.id,
        "notice_type": n.notice_type,
        "served_date": n.served_date.isoformat(),
        "possession_date": n.possession_date.isoformat() if n.possession_date else None,
        "court_date": n.court_date.isoformat() if n.court_date else None,
        "arrears_amount": n.arrears_amount,
        "custom_notes": n.custom_notes,
        "checks": {
            "gas_cert": n.check_gas_cert,
            "epc": n.check_epc,
            "deposit": n.check_deposit,
            "how_to_rent": n.check_how_to_rent,
        },
        "lease_id": n.lease_id,
        "tenant_name": tenant.full_name if tenant else "—",
        "unit": f"{prop.name} · {unit.name}" if prop and unit else "—",
        "property_address": f"{prop.address_line1}, {prop.city}" if prop else "—",
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# --- GET leases eligible for notices ---

@router.get("/leases")
def leases_for_notices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    leases = (
        db.query(Lease).join(Unit).join(Property)
        .filter(
            Property.organisation_id == current_user.organisation_id,
            Lease.status == "active",
        )
        .all()
    )
    result = []
    for l in leases:
        unit = l.unit
        prop = unit.property if unit else None
        tenant = db.query(Tenant).filter(Tenant.id == l.tenant_id).first()
        arrears = _arrears_for_lease(l.id, db)
        result.append({
            "id": l.id,
            "tenant_name": tenant.full_name if tenant else "—",
            "tenant_email": tenant.email if tenant else None,
            "unit": f"{prop.name} · {unit.name}" if prop and unit else "—",
            "property_address": f"{prop.address_line1}, {prop.city}" if prop else "—",
            "monthly_rent": l.monthly_rent,
            "start_date": l.start_date.isoformat() if l.start_date else None,
            "end_date": l.end_date.isoformat() if l.end_date else None,
            "current_arrears": arrears,
        })
    return result


# --- Pre-flight check ---

@router.get("/preflight/{lease_id}")
def preflight(
    lease_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lease, tenant, unit, org = _get_lease(lease_id, current_user.organisation_id, db)
    checks = _preflight_checks(lease, db)
    arrears = _arrears_for_lease(lease_id, db)
    return {
        "checks": checks,
        "current_arrears": arrears,
        "tenant_name": tenant.full_name if tenant else "—",
        "property_address": f"{unit.property.address_line1}, {unit.property.city}" if unit and unit.property else "—",
        "monthly_rent": lease.monthly_rent,
        "start_date": lease.start_date.isoformat() if lease.start_date else None,
        "possession_date": (date.today() + timedelta(days=60)).isoformat(),
        "court_date": (date.today() + timedelta(days=14)).isoformat(),
    }


# --- List notices ---

@router.get("")
def list_notices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notices = (
        db.query(LegalNotice)
        .filter(LegalNotice.organisation_id == current_user.organisation_id)
        .order_by(LegalNotice.served_date.desc())
        .all()
    )
    return [_notice_out(n, db) for n in notices]


# --- Issue a notice (log + generate PDF) ---

class IssueNoticeRequest(BaseModel):
    lease_id: int
    notice_type: str          # section_21 | section_8
    arrears_amount: Optional[float] = None
    custom_notes: Optional[str] = None
    check_how_to_rent: bool = False   # agent confirms How to Rent guide was served


@router.post("")
def issue_notice(
    req: IssueNoticeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.notice_type not in ("section_21", "section_8"):
        raise HTTPException(status_code=400, detail="notice_type must be section_21 or section_8")

    lease, tenant, unit, org = _get_lease(req.lease_id, current_user.organisation_id, db)
    checks = _preflight_checks(lease, db)
    today = date.today()

    # Block S21 if fixed term check fails
    if req.notice_type == "section_21" and checks.get("fixed_term") == "fail":
        raise HTTPException(
            status_code=400,
            detail="Section 21 cannot be served in the first 4 months of a tenancy."
        )

    possession_date = today + timedelta(days=60) if req.notice_type == "section_21" else None
    court_date = today + timedelta(days=14) if req.notice_type == "section_8" else None
    arrears = req.arrears_amount if req.arrears_amount is not None else _arrears_for_lease(req.lease_id, db)

    # Log the notice
    notice = LegalNotice(
        organisation_id=current_user.organisation_id,
        lease_id=req.lease_id,
        notice_type=req.notice_type,
        served_date=today,
        possession_date=possession_date,
        court_date=court_date,
        arrears_amount=arrears if req.notice_type == "section_8" else None,
        custom_notes=req.custom_notes,
        check_gas_cert=checks.get("gas_cert"),
        check_epc=checks.get("epc"),
        check_deposit=checks.get("deposit"),
        check_how_to_rent="pass" if req.check_how_to_rent else "unconfirmed",
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)

    # Telegram alert
    prop = unit.property if unit else None
    label = f"{prop.name} · {unit.name}" if prop and unit else "—"
    notifications.send(
        f"⚖️ <b>Legal Notice Issued: {req.notice_type.replace('_', ' ').title()}</b>\n\n"
        f"Tenant: {tenant.full_name if tenant else '—'}\n"
        f"Property: {label}\n"
        f"Served: {today.strftime('%-d %B %Y')}"
        + (f"\nArrears: £{arrears:.2f}" if req.notice_type == "section_8" else "")
    )

    # Generate PDF
    if req.notice_type == "section_21":
        pdf = docgen.generate_section21(lease, tenant, unit, org)
        filename = f"Section21_{tenant.full_name.replace(' ', '_')}_{today}.pdf"
    else:
        pdf = docgen.generate_section8(lease, tenant, unit, org, arrears, req.custom_notes or "")
        filename = f"Section8_{tenant.full_name.replace(' ', '_')}_{today}.pdf"

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Notice-Id": str(notice.id),
        },
    )


# --- Re-download a previously issued notice ---

@router.get("/{notice_id}/pdf")
def redownload_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notice = db.query(LegalNotice).filter(
        LegalNotice.id == notice_id,
        LegalNotice.organisation_id == current_user.organisation_id,
    ).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    lease, tenant, unit, org = _get_lease(notice.lease_id, current_user.organisation_id, db)

    if notice.notice_type == "section_21":
        pdf = docgen.generate_section21(lease, tenant, unit, org)
        filename = f"Section21_{tenant.full_name.replace(' ', '_')}_{notice.served_date}.pdf"
    else:
        pdf = docgen.generate_section8(lease, tenant, unit, org, notice.arrears_amount or 0, notice.custom_notes or "")
        filename = f"Section8_{tenant.full_name.replace(' ', '_')}_{notice.served_date}.pdf"

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
