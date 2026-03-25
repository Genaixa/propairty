from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.lease import Lease
from app.models.renewal import LeaseRenewal
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
from app import emails, notifications, docgen

router = APIRouter(prefix="/api/renewals", tags=["renewals"])

EXPIRY_WINDOW_DAYS = 90  # leases expiring within this are surfaced


class RenewalCreate(BaseModel):
    lease_id: int
    proposed_rent: float
    proposed_start: date
    proposed_end: Optional[date] = None
    is_periodic: str = "fixed"
    agent_notes: Optional[str] = None


def _renewal_out(r: LeaseRenewal) -> dict:
    lease = r.lease
    tenant = lease.tenant if lease else None
    unit = lease.unit if lease else None
    prop = unit.property if unit else None
    return {
        "id": r.id,
        "lease_id": r.lease_id,
        "tenant_name": tenant.full_name if tenant else None,
        "tenant_email": tenant.email if tenant else None,
        "property": prop.name if prop else None,
        "unit": unit.name if unit else None,
        "current_rent": lease.monthly_rent if lease else None,
        "current_end": lease.end_date.isoformat() if lease and lease.end_date else None,
        "proposed_rent": r.proposed_rent,
        "proposed_start": r.proposed_start.isoformat(),
        "proposed_end": r.proposed_end.isoformat() if r.proposed_end else None,
        "is_periodic": r.is_periodic,
        "status": r.status,
        "agent_notes": r.agent_notes,
        "tenant_notes": r.tenant_notes,
        "sent_at": r.sent_at.isoformat() if r.sent_at else None,
        "responded_at": r.responded_at.isoformat() if r.responded_at else None,
    }


def _lease_out(lease: Lease, renewal: LeaseRenewal = None) -> dict:
    tenant = lease.tenant
    unit = lease.unit
    prop = unit.property if unit else None
    days_to_expiry = None
    if lease.end_date:
        days_to_expiry = (lease.end_date - date.today()).days
    return {
        "lease_id": lease.id,
        "tenant_name": tenant.full_name if tenant else None,
        "tenant_email": tenant.email if tenant else None,
        "tenant_id": tenant.id if tenant else None,
        "property": prop.name if prop else None,
        "unit": unit.name if unit else None,
        "monthly_rent": lease.monthly_rent,
        "start_date": lease.start_date.isoformat(),
        "end_date": lease.end_date.isoformat() if lease.end_date else None,
        "days_to_expiry": days_to_expiry,
        "is_periodic": lease.is_periodic,
        "renewal": _renewal_out(renewal) if renewal else None,
    }


@router.get("")
def list_renewals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns expiring leases + any existing renewal offers."""
    cutoff = date.today() + timedelta(days=EXPIRY_WINDOW_DAYS)
    today = date.today()

    leases = (
        db.query(Lease)
        .join(Unit).join(Property)
        .filter(
            Lease.status == "active",
            Property.organisation_id == current_user.organisation_id,
        )
        .all()
    )

    expiring = []
    for lease in leases:
        if not lease.end_date or lease.is_periodic:
            continue
        if lease.end_date <= cutoff:
            latest_renewal = lease.renewals[0] if lease.renewals else None
            expiring.append(_lease_out(lease, latest_renewal))

    # Also include any sent/pending renewals beyond the 90 day window
    renewal_lease_ids = {l["lease_id"] for l in expiring}
    extra_renewals = (
        db.query(LeaseRenewal)
        .join(Lease).join(Unit).join(Property)
        .filter(
            LeaseRenewal.status == "sent",
            Property.organisation_id == current_user.organisation_id,
        )
        .all()
    )
    for r in extra_renewals:
        if r.lease_id not in renewal_lease_ids:
            expiring.append(_lease_out(r.lease, r))

    expiring.sort(key=lambda x: x["days_to_expiry"] or 9999)
    return expiring


@router.post("")
def create_renewal(
    data: RenewalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lease = (
        db.query(Lease).join(Unit).join(Property)
        .filter(
            Lease.id == data.lease_id,
            Lease.status == "active",
            Property.organisation_id == current_user.organisation_id,
        )
        .first()
    )
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")

    # Expire any existing pending renewals for this lease
    db.query(LeaseRenewal).filter(
        LeaseRenewal.lease_id == lease.id,
        LeaseRenewal.status == "sent"
    ).update({"status": "expired"})

    renewal = LeaseRenewal(
        lease_id=lease.id,
        proposed_rent=data.proposed_rent,
        proposed_start=data.proposed_start,
        proposed_end=data.proposed_end,
        is_periodic=data.is_periodic,
        agent_notes=data.agent_notes,
        status="sent",
    )
    db.add(renewal)
    db.commit()
    db.refresh(renewal)

    # Notify tenant
    _notify_tenant_renewal_offer(renewal, lease, db)

    # Telegram alert
    unit = lease.unit
    prop = unit.property if unit else None
    tenant = lease.tenant
    notifications.send(
        f"📋 <b>Renewal Offer Sent</b>\n\n"
        f"Tenant: {tenant.full_name if tenant else 'Unknown'}\n"
        f"Property: {prop.name if prop else '?'} · {unit.name if unit else '?'}\n"
        f"Current rent: £{lease.monthly_rent:,.0f} → Proposed: £{data.proposed_rent:,.0f}\n"
        f"New term: {data.proposed_start}"
        + (f" to {data.proposed_end}" if data.proposed_end else " (periodic)")
    )

    return _renewal_out(renewal)


@router.put("/{renewal_id}/respond")
def agent_respond(
    renewal_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Agent can manually mark a renewal as accepted or declined."""
    renewal = (
        db.query(LeaseRenewal).join(Lease).join(Unit).join(Property)
        .filter(
            LeaseRenewal.id == renewal_id,
            Property.organisation_id == current_user.organisation_id,
        )
        .first()
    )
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal not found")
    if status not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="status must be accepted or declined")

    renewal.status = status
    renewal.responded_at = func.now()
    db.commit()

    if status == "accepted":
        return _accept_renewal(renewal, db)

    db.refresh(renewal)
    return _renewal_out(renewal)


@router.get("/{renewal_id}/report")
def download_renewal_letter(
    renewal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    renewal = (
        db.query(LeaseRenewal).join(Lease).join(Unit).join(Property)
        .filter(
            LeaseRenewal.id == renewal_id,
            Property.organisation_id == current_user.organisation_id,
        )
        .first()
    )
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal not found")

    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    pdf_bytes = docgen.generate_renewal_offer(renewal, org)
    filename = f"renewal-offer-{renewal_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# Tenant portal endpoints are in tenant_portal.py (get_current_tenant dependency)


def _accept_renewal(renewal: LeaseRenewal, db: Session) -> dict:
    """Create new lease, expire old one, send confirmation email."""
    old_lease = renewal.lease
    tenant = old_lease.tenant
    unit = old_lease.unit
    org = db.query(Organisation).filter(Organisation.id == unit.property.organisation_id).first()

    # Create new lease
    new_lease = Lease(
        unit_id=old_lease.unit_id,
        tenant_id=old_lease.tenant_id,
        start_date=renewal.proposed_start,
        end_date=renewal.proposed_end,
        monthly_rent=renewal.proposed_rent,
        deposit=old_lease.deposit,
        status="active",
        rent_day=old_lease.rent_day,
        is_periodic=(renewal.is_periodic == "periodic"),
    )
    db.add(new_lease)

    # Expire old lease
    old_lease.status = "expired"

    db.commit()
    db.refresh(new_lease)

    # Generate new AST PDF and email to tenant
    if tenant and tenant.email:
        try:
            pdf_bytes = docgen.generate_ast(new_lease, tenant, unit, org)
            _send_renewal_confirmation(tenant, new_lease, unit, org, pdf_bytes)
        except Exception as e:
            print(f"[renewal] Failed to generate/send PDF: {e}")

    notifications.send(
        f"✅ <b>Lease Renewed</b>\n\n"
        f"Tenant: {tenant.full_name if tenant else 'Unknown'}\n"
        f"Property: {unit.property.name} · {unit.name}\n"
        f"New rent: £{renewal.proposed_rent:,.0f}/mo\n"
        f"New term: {renewal.proposed_start}"
        + (f" to {renewal.proposed_end}" if renewal.proposed_end else " (periodic)")
    )

    db.refresh(renewal)
    return {"ok": True, "status": "accepted", "new_lease_id": new_lease.id}


def _notify_tenant_renewal_offer(renewal: LeaseRenewal, lease: Lease, db: Session):
    tenant = lease.tenant
    if not tenant or not tenant.email:
        return
    unit = lease.unit
    prop = unit.property if unit else None
    org = db.query(Organisation).filter(Organisation.id == (prop.organisation_id if prop else 0)).first()
    org_name = org.name if org else "Your Letting Agent"

    rent_change = renewal.proposed_rent - lease.monthly_rent
    rent_change_str = (
        f"+£{rent_change:,.0f}/mo" if rent_change > 0
        else (f"-£{abs(rent_change):,.0f}/mo" if rent_change < 0 else "unchanged")
    )

    end_str = renewal.proposed_end.strftime("%-d %B %Y") if renewal.proposed_end else "Rolling (periodic)"
    subject = "Your tenancy renewal offer"
    body = f"""
    <h2>Tenancy Renewal Offer</h2>
    <p>Hi {tenant.full_name.split()[0]},</p>
    <p>We'd like to offer you the opportunity to renew your tenancy at <strong>{prop.name if prop else ''}, {unit.name if unit else ''}</strong>.</p>
    <div class="amount-box">
      <div class="label">Proposed Monthly Rent</div>
      <div class="amount">£{renewal.proposed_rent:,.0f} <span style="font-size:14px;font-weight:400">({rent_change_str})</span></div>
    </div>
    <p>
      <strong>New start date:</strong> {renewal.proposed_start.strftime("%-d %B %Y")}<br>
      <strong>New end date:</strong> {end_str}
    </p>
    {f'<p><strong>Notes from your letting agent:</strong> {renewal.agent_notes}</p>' if renewal.agent_notes else ''}
    <p>Please log in to your tenant portal to accept or decline this offer. If you have any questions, please don't hesitate to contact us.</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
    """
    html = emails._base_template(subject, body, org_name)
    emails._send_email(tenant.email, subject, html)


def _send_renewal_confirmation(tenant, lease: Lease, unit, org, pdf_bytes: bytes):
    import smtplib
    import ssl
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication
    from app.config import settings

    if not settings.smtp_host or not settings.smtp_user:
        return

    org_name = org.name if org else "Your Letting Agent"
    end_str = lease.end_date.strftime("%-d %B %Y") if lease.end_date else "Rolling (periodic)"
    subject = "Tenancy renewal confirmed — new agreement enclosed"
    body_html = emails._base_template(
        subject,
        f"""
        <h2>Tenancy Renewed</h2>
        <p>Hi {tenant.full_name.split()[0]},</p>
        <p>Great news — your tenancy has been renewed. Your new agreement is attached to this email.</p>
        <div class="amount-box">
          <div class="label">Monthly Rent</div>
          <div class="amount">£{lease.monthly_rent:,.0f}</div>
        </div>
        <p><strong>Start date:</strong> {lease.start_date.strftime("%-d %B %Y")}<br>
        <strong>End date:</strong> {end_str}</p>
        <p>Please review the attached agreement and keep it for your records.</p>
        <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
        """,
        org_name,
    )

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = tenant.email
    msg.attach(MIMEText(body_html, "html"))

    pdf_part = MIMEApplication(pdf_bytes, _subtype="pdf")
    pdf_part.add_header("Content-Disposition", "attachment", filename=f"tenancy-agreement-{lease.id}.pdf")
    msg.attach(pdf_part)

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, tenant.email, msg.as_string())
        print(f"[renewal] Sent confirmation + AST PDF to {tenant.email}")
    except Exception as e:
        print(f"[renewal] Email failed: {e}")
