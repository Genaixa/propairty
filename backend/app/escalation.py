"""
Rent arrears escalation logic — runs as part of the daily check.
Triggered when a payment is 7+ days overdue.

Actions (each fires once per payment):
  1. Flag the agent via Telegram alert
  2. Generate and save an arrears letter PDF attached to the tenant
  3. If arrears >= 2 months rent, generate and save a Section 8 notice PDF
"""
import uuid
import os
from datetime import date, timedelta
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.lease import Lease
from app.models.payment import RentPayment
from app.models.tenant import Tenant
from app.models.tenant_notification import TenantNotification
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
from app.models.upload import UploadedFile
from app import notifications, docgen

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/root/propairty/uploads"))

_ARREARS_LETTER_DESC = "Auto-generated arrears letter"
_SECTION8_DESC = "Auto-generated Section 8 notice (draft)"


def _already_generated(db: Session, tenant_id: int, description: str) -> bool:
    return db.query(UploadedFile).filter(
        UploadedFile.entity_type == "tenant",
        UploadedFile.entity_id == tenant_id,
        UploadedFile.description == description,
    ).first() is not None


def _save_pdf(db: Session, pdf_bytes: bytes, filename: str, original_name: str,
              tenant_id: int, organisation_id: int, description: str):
    dest = UPLOAD_DIR / filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(pdf_bytes)

    record = UploadedFile(
        organisation_id=organisation_id,
        entity_type="tenant",
        entity_id=tenant_id,
        filename=filename,
        original_name=original_name,
        mime_type="application/pdf",
        file_size=len(pdf_bytes),
        category="correspondence",
        description=description,
    )
    db.add(record)


def run_escalation(db: Session):
    """
    Called daily. For each payment exactly 7 days overdue, escalate once.
    """
    today = date.today()
    target_date = today - timedelta(days=7)

    overdue_payments = (
        db.query(RentPayment)
        .join(Lease, RentPayment.lease_id == Lease.id)
        .filter(
            RentPayment.due_date == target_date,
            RentPayment.status != "paid",
        )
        .all()
    )

    for payment in overdue_payments:
        lease = db.query(Lease).filter(Lease.id == payment.lease_id).first()
        if not lease:
            continue
        tenant = lease.tenant
        unit = lease.unit
        if not tenant or not unit:
            continue
        prop = db.query(Property).filter(Property.id == unit.property_id).first()
        org = db.query(Organisation).filter(Organisation.id == prop.organisation_id).first() if prop else None
        if not prop or not org:
            continue

        arrears = payment.amount_due - (payment.amount_paid or 0)
        two_months_rent = lease.monthly_rent * 2
        address = f"{prop.address_line1}, {prop.city}, {prop.postcode}"

        # 1. Telegram alert to agent (fires every day it's exactly at 7-day mark, once per payment)
        notifications.send(
            f"🚨 <b>Rent Arrears Escalation — 7 Days Overdue</b>\n\n"
            f"Tenant: {tenant.full_name}\n"
            f"Property: {prop.name} · {unit.name}\n"
            f"Amount overdue: £{arrears:.2f}\n"
            f"Due date: {payment.due_date}\n\n"
            f"Arrears letter and{' Section 8 notice' if arrears >= two_months_rent else ''} "
            f"documents have been auto-generated and attached to the tenant record."
        )

        # 2. Arrears letter — once per payment
        if not _already_generated(db, tenant.id, _ARREARS_LETTER_DESC):
            try:
                pdf = _generate_arrears_letter(tenant, lease, unit, prop, org, arrears)
                fname = f"{uuid.uuid4().hex}_arrears_letter.pdf"
                _save_pdf(db, pdf, fname, f"Arrears_Letter_{tenant.full_name.replace(' ','_')}.pdf",
                          tenant.id, org.id, _ARREARS_LETTER_DESC)
            except Exception as e:
                print(f"[escalation] Arrears letter generation failed for tenant {tenant.id}: {e}")

        # 3. Section 8 — only if >= 2 months arrears, once per payment
        if arrears >= two_months_rent and not _already_generated(db, tenant.id, _SECTION8_DESC):
            try:
                pdf = docgen.generate_section8(lease, tenant, unit, org, arrears)
                fname = f"{uuid.uuid4().hex}_section8.pdf"
                _save_pdf(db, pdf, fname, f"Section8_Notice_{tenant.full_name.replace(' ','_')}.pdf",
                          tenant.id, org.id, _SECTION8_DESC)
            except Exception as e:
                print(f"[escalation] Section 8 generation failed for tenant {tenant.id}: {e}")

        # 4. In-portal notification for tenant
        if tenant.portal_enabled:
            notif = TenantNotification(
                tenant_id=tenant.id,
                message=(
                    f"Your rent of £{arrears:.2f} is now 7 days overdue. "
                    f"Please contact your letting agent urgently to avoid formal action."
                ),
                type="urgent",
            )
            db.add(notif)

    db.commit()


def _generate_arrears_letter(tenant, lease, unit, prop, org, arrears: float) -> bytes:
    """Generate a formal rent arrears letter as PDF using WeasyPrint."""
    from datetime import date
    import weasyprint

    today = date.today().strftime("%-d %B %Y")
    address = f"{prop.address_line1}, {prop.city}, {prop.postcode}"
    first = tenant.full_name.split()[0]

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: Georgia, serif; font-size: 12pt; color: #111; margin: 60px; line-height: 1.7; }}
  .header {{ border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 32px; }}
  .org {{ font-size: 18pt; font-weight: bold; }}
  .ref {{ color: #555; font-size: 10pt; margin-top: 4px; }}
  p {{ margin: 0 0 14px; }}
  .amount {{ font-size: 14pt; font-weight: bold; }}
  .footer {{ margin-top: 48px; border-top: 1px solid #ccc; padding-top: 16px; font-size: 10pt; color: #555; }}
</style>
</head>
<body>
<div class="header">
  <div class="org">{org.name}</div>
  <div class="ref">Ref: ARR-{lease.id:04d} &nbsp;|&nbsp; {today}</div>
</div>

<p><strong>{tenant.full_name}</strong><br>{address}</p>

<p>Dear {first},</p>

<p><strong>RE: RENT ARREARS — FORMAL NOTICE</strong></p>

<p>We write to notify you that your rent account is currently in arrears.
According to our records, the following amount is overdue:</p>

<p class="amount">Amount outstanding: £{arrears:,.2f}</p>
<p>Original due date: {lease.rent_day}{_ordinal(lease.rent_day)} of the month<br>
Property: {prop.name}, {unit.name}<br>{address}</p>

<p>We require payment of the full outstanding amount within <strong>7 days</strong> of the
date of this letter. Failure to make payment within this period may result in us taking
formal legal action, which could include:</p>

<p>• The service of a Section 8 Notice seeking possession of the property<br>
• County Court proceedings for the recovery of debt<br>
• An adverse entry on your credit record</p>

<p>If you are experiencing financial difficulties, we urge you to contact us immediately
to discuss a repayment arrangement. We are willing to work with you to resolve this matter,
but prompt contact is essential.</p>

<p>Payment can be made via your tenant portal at: {org.name}'s letting portal</p>

<p>If you have already made payment, please disregard this letter and accept our apologies
for any inconvenience caused.</p>

<p>Yours sincerely,</p>
<p><strong>{org.name}</strong><br>Letting Management</p>

<div class="footer">
  This letter has been generated automatically by PropAIrty on behalf of {org.name}.
  It constitutes a formal notice of rent arrears. Please retain this document for your records.
</div>
</body>
</html>"""

    return weasyprint.HTML(string=html).write_pdf()


def _ordinal(n: int) -> str:
    if 11 <= (n % 100) <= 13:
        return "th"
    return ["th", "st", "nd", "rd", "th"][min(n % 10, 4)]
