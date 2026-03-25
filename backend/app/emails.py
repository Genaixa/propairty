import html
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.config import settings
from app.models.lease import Lease
from app.models.payment import RentPayment
from app.models.tenant import Tenant
from app.models.tenant_notification import TenantNotification
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
from app.models.user import User
from app.models.compliance import ComplianceCertificate, CERT_TYPES


def _send_email(to_email: str, subject: str, html: str):
    if not settings.smtp_host or not settings.smtp_user:
        print(f"[email] SMTP not configured — skipping email to {to_email}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, to_email, msg.as_string())
        print(f"[email] Sent '{subject}' to {to_email}")
        return True
    except Exception as e:
        print(f"[email] Failed to send to {to_email}: {e}")
        return False


def _base_template(title: str, body: str, org_name: str = "Your Letting Agent") -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 0; }}
  .wrapper {{ max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }}
  .header {{ background: #4f46e5; padding: 24px 32px; }}
  .header h1 {{ color: white; margin: 0; font-size: 20px; font-weight: 700; }}
  .header p {{ color: #c7d2fe; margin: 4px 0 0; font-size: 13px; }}
  .body {{ padding: 32px; }}
  .body h2 {{ color: #111827; font-size: 18px; margin: 0 0 12px; }}
  .body p {{ color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 12px; }}
  .amount-box {{ background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }}
  .amount-box .label {{ font-size: 12px; color: #0369a1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }}
  .amount-box .amount {{ font-size: 28px; font-weight: 800; color: #0c4a6e; margin-top: 4px; }}
  .overdue-box {{ background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }}
  .overdue-box .label {{ font-size: 12px; color: #dc2626; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }}
  .overdue-box .amount {{ font-size: 28px; font-weight: 800; color: #7f1d1d; margin-top: 4px; }}
  .cta {{ display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 8px 0; }}
  .footer {{ background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px; }}
  .footer p {{ color: #9ca3af; font-size: 12px; margin: 0; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>PropAIrty</h1>
    <p>{org_name}</p>
  </div>
  <div class="body">
    {body}
  </div>
  <div class="footer">
    <p>This is an automated message from PropAIrty on behalf of {org_name}. Please do not reply to this email.</p>
  </div>
</div>
</body>
</html>"""


def send_password_reset(to_email: str, reset_url: str, portal_name: str = "PropAIrty"):
    body = f"""
    <h2>Reset your password</h2>
    <p>We received a request to reset the password for your <strong>{portal_name}</strong> account.</p>
    <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <p style="margin: 24px 0;">
      <a href="{reset_url}" class="cta">Reset Password</a>
    </p>
    <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
    """
    _send_email(to_email, f"Reset your {portal_name} password", _base_template(f"Reset your password", body))


def send_rent_reminder(tenant: Tenant, payment: RentPayment, lease: Lease, unit: Unit, prop: Property, org: Organisation, days_until_due: int):
    if not tenant.email:
        return
    if days_until_due > 0:
        subject = f"Rent reminder — £{payment.amount_due:.0f} due in {days_until_due} day{'s' if days_until_due > 1 else ''}"
        body = f"""
        <h2>Upcoming rent payment</h2>
        <p>Hi {tenant.full_name.split()[0]},</p>
        <p>This is a friendly reminder that your rent payment is due in <strong>{days_until_due} day{'s' if days_until_due > 1 else ''}</strong>.</p>
        <div class="amount-box">
          <div class="label">Amount Due</div>
          <div class="amount">£{payment.amount_due:.2f}</div>
        </div>
        <p><strong>Due date:</strong> {payment.due_date.strftime('%A, %d %B %Y')}<br>
        <strong>Property:</strong> {prop.name}, {unit.name}</p>
        <p>Please ensure payment reaches us by the due date to avoid any late fees.</p>
        <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
        """
    elif days_until_due == 0:
        subject = f"Rent due today — £{payment.amount_due:.0f}"
        body = f"""
        <h2>Your rent is due today</h2>
        <p>Hi {tenant.full_name.split()[0]},</p>
        <p>Your rent payment of <strong>£{payment.amount_due:.2f}</strong> is due <strong>today, {payment.due_date.strftime('%d %B %Y')}</strong>.</p>
        <div class="amount-box">
          <div class="label">Amount Due Today</div>
          <div class="amount">£{payment.amount_due:.2f}</div>
        </div>
        <p><strong>Property:</strong> {prop.name}, {unit.name}</p>
        <p>If you have already made payment, please disregard this message.</p>
        <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
        """
    else:
        days_overdue = abs(days_until_due)
        subject = f"Overdue rent — £{payment.amount_due:.0f} ({days_overdue} day{'s' if days_overdue > 1 else ''} overdue)"
        body = f"""
        <h2>Rent payment overdue</h2>
        <p>Hi {tenant.full_name.split()[0]},</p>
        <p>We have not yet received your rent payment which was due on <strong>{payment.due_date.strftime('%d %B %Y')}</strong>.</p>
        <div class="overdue-box">
          <div class="label">Overdue Amount</div>
          <div class="amount">£{payment.amount_due:.2f}</div>
        </div>
        <p><strong>Property:</strong> {prop.name}, {unit.name}<br>
        <strong>Days overdue:</strong> {days_overdue}</p>
        <p>Please make payment as soon as possible or contact us to discuss your situation. Continued non-payment may result in formal action.</p>
        <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
        """

    html = _base_template(subject, body, org.name)
    _send_email(tenant.email, subject, html)


def send_payment_receipt(tenant: Tenant, payment, prop: Property, unit: Unit, org: Organisation):
    if not tenant.email:
        return
    subject = f"Payment confirmed — £{payment.amount_paid:.2f} received"
    body = f"""
    <h2>Payment received — thank you!</h2>
    <p>Hi {tenant.full_name.split()[0]},</p>
    <p>We have received your rent payment. Here is your receipt.</p>
    <div class="amount-box">
      <div class="label">Amount Paid</div>
      <div class="amount">£{payment.amount_paid:.2f}</div>
    </div>
    <p>
      <strong>Date paid:</strong> {payment.paid_date.strftime('%d %B %Y') if payment.paid_date else 'Today'}<br>
      <strong>Period:</strong> {payment.due_date.strftime('%B %Y') if payment.due_date else '—'}<br>
      <strong>Property:</strong> {prop.name}, {unit.name}
    </p>
    <p>Please keep this email as your receipt. If you have any questions please contact your letting agent.</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
    """
    html = _base_template(subject, body, org.name)
    _send_email(tenant.email, subject, html)


def send_maintenance_update(tenant: Tenant, job_title: str, new_status: str, org: Organisation):
    if not tenant.email:
        return
    status_labels = {
        "open": "received and logged",
        "in_progress": "in progress — we're working on it",
        "completed": "completed",
        "cancelled": "cancelled",
    }
    label = status_labels.get(new_status, new_status)
    subject = f"Maintenance update: {job_title}"
    safe_title = html.escape(job_title)
    safe_name = html.escape(tenant.full_name.split()[0])
    body = f"""
    <h2>Maintenance request update</h2>
    <p>Hi {safe_name},</p>
    <p>Your maintenance request has been updated.</p>
    <div class="amount-box">
      <div class="label">Job</div>
      <div class="amount" style="font-size:18px">{safe_title}</div>
    </div>
    <p><strong>Status:</strong> {label.capitalize()}</p>
    <p>You can track all your maintenance requests in your tenant portal.</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
    """
    html = _base_template(subject, body, org.name)
    _send_email(tenant.email, subject, html)


def send_agent_renewal_reminders(db: Session):
    """Email agents about leases expiring in 90, 60, or 30 days (sent on exact threshold days)."""
    today = date.today()
    thresholds = [90, 60, 30]

    # Find all orgs
    orgs = db.query(Organisation).all()
    for org in orgs:
        # Get all agent emails for this org
        agents = db.query(User).filter(User.organisation_id == org.id, User.is_active == True).all()
        agent_emails = [u.email for u in agents if u.email]
        if not agent_emails:
            continue

        expiring_leases = []
        for days in thresholds:
            target = today + timedelta(days=days)
            leases = db.query(Lease).filter(
                Lease.status == "active",
                Lease.end_date == target,
            ).all()
            for lease in leases:
                unit = lease.unit
                prop = unit.property if unit else None
                if prop and prop.organisation_id == org.id:
                    expiring_leases.append((days, lease, unit, prop))

        if not expiring_leases:
            continue

        rows_html = ""
        for days, lease, unit, prop in sorted(expiring_leases, key=lambda x: x[0]):
            tenant = lease.tenant
            urgency_color = "#dc2626" if days <= 30 else ("#ea580c" if days <= 60 else "#ca8a04")
            rows_html += f"""
            <tr>
              <td style="padding:10px 12px; border-bottom:1px solid #f3f4f6;">
                <strong>{tenant.full_name if tenant else 'Unknown'}</strong><br>
                <span style="color:#6b7280;font-size:12px;">{prop.name} · {unit.name}</span>
              </td>
              <td style="padding:10px 12px; border-bottom:1px solid #f3f4f6; color:#6b7280; font-size:13px;">{lease.end_date}</td>
              <td style="padding:10px 12px; border-bottom:1px solid #f3f4f6;">
                <span style="color:{urgency_color}; font-weight:700;">{days} days</span>
              </td>
              <td style="padding:10px 12px; border-bottom:1px solid #f3f4f6; font-weight:600;">£{lease.monthly_rent:,.0f}/mo</td>
            </tr>"""

        subject = f"Lease renewal reminder — {len(expiring_leases)} lease(s) expiring soon"
        body = f"""
        <h2>Lease Renewal Reminder</h2>
        <p>The following leases are approaching their expiry date. Log in to PropAIrty to send renewal offers.</p>
        <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280;">Tenant</th>
              <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280;">Expires</th>
              <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280;">Days Left</th>
              <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280;">Rent</th>
            </tr>
          </thead>
          <tbody>{rows_html}</tbody>
        </table>
        <a href="https://propairty.co.uk/renewals" class="cta">Manage Renewals</a>
        """
        html = _base_template(subject, body, org.name)
        for email in agent_emails:
            _send_email(email, subject, html)


def send_agent_compliance_reminders(db: Session):
    """Email agents about compliance certs expiring in 60, 30, or 7 days."""
    today = date.today()
    thresholds = [60, 30, 7]

    orgs = db.query(Organisation).all()
    for org in orgs:
        agents = db.query(User).filter(User.organisation_id == org.id, User.is_active == True).all()
        agent_emails = [u.email for u in agents if u.email]
        if not agent_emails:
            continue

        expiring_certs = []
        for days in thresholds:
            target = today + timedelta(days=days)
            certs = db.query(ComplianceCertificate).filter(
                ComplianceCertificate.expiry_date == target,
            ).all()
            for cert in certs:
                if cert.property and cert.property.organisation_id == org.id:
                    expiring_certs.append((days, cert))

        if not expiring_certs:
            continue

        rows_html = ""
        for days, cert in sorted(expiring_certs, key=lambda x: x[0]):
            label = CERT_TYPES.get(cert.cert_type, {}).get("label", cert.cert_type)
            urgency_color = "#dc2626" if days <= 7 else ("#ea580c" if days <= 30 else "#ca8a04")
            rows_html += f"""
            <tr>
              <td style="padding:10px 12px; border-bottom:1px solid #f3f4f6;">
                <strong>{cert.property.name}</strong>
              </td>
              <td style="padding:10px 12px; border-bottom:1px solid #f3f4f6; color:#6b7280; font-size:13px;">{label}</td>
              <td style="padding:10px 12px; border-bottom:1px solid #f3f4f6; color:#6b7280; font-size:13px;">{cert.expiry_date}</td>
              <td style="padding:10px 12px; border-bottom:1px solid #f3f4f6;">
                <span style="color:{urgency_color}; font-weight:700;">{days} days</span>
              </td>
            </tr>"""

        subject = f"Compliance reminder — {len(expiring_certs)} certificate(s) expiring soon"
        body = f"""
        <h2>Compliance Certificate Reminder</h2>
        <p>The following compliance certificates are approaching expiry. Please arrange renewals promptly.</p>
        <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280;">Property</th>
              <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280;">Certificate</th>
              <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280;">Expiry Date</th>
              <th style="padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280;">Days Left</th>
            </tr>
          </thead>
          <tbody>{rows_html}</tbody>
        </table>
        <a href="https://propairty.co.uk/compliance" class="cta">Manage Compliance</a>
        """
        html = _base_template(subject, body, org.name)
        for email in agent_emails:
            _send_email(email, subject, html)


def _whatsapp_reminder_text(tenant: "Tenant", payment, prop, unit, days_until_due: int) -> str:
    first = tenant.full_name.split()[0]
    amount = f"£{payment.amount_due:.2f}"
    if days_until_due > 0:
        return (
            f"Hi {first}, this is a reminder from PropAIrty that your rent of {amount} "
            f"is due in {days_until_due} day{'s' if days_until_due > 1 else ''} "
            f"({payment.due_date.strftime('%d %b %Y')}) for {prop.name}, {unit.name}. "
            f"Pay online: {settings.app_base_url}/tenant/portal"
        )
    elif days_until_due == 0:
        return (
            f"Hi {first}, your rent of {amount} for {prop.name}, {unit.name} is due TODAY. "
            f"Pay online: {settings.app_base_url}/tenant/portal"
        )
    else:
        days_overdue = abs(days_until_due)
        return (
            f"Hi {first}, your rent of {amount} for {prop.name}, {unit.name} is "
            f"{days_overdue} day{'s' if days_overdue > 1 else ''} overdue. "
            f"Please pay now: {settings.app_base_url}/tenant/portal or contact your agent."
        )


def _notification_type(days_until_due: int) -> str:
    if days_until_due >= 0:
        return "info"
    elif days_until_due >= -3:
        return "warning"
    return "urgent"


def run_rent_reminders(db: Session):
    """Run daily — send reminders for payments due in 3 days, today, and 1/3/7 days overdue.
    Cascade: email → WhatsApp → SMS (fallback only if no email and no WhatsApp)."""
    from app import whatsapp as wa, sms as sm

    today = date.today()
    # days_until_due: positive = upcoming, 0 = today, negative = overdue
    trigger_days = [3, 1, 0, -1, -3, -7]

    active_leases = db.query(Lease).filter(Lease.status == "active").all()

    for lease in active_leases:
        tenant = lease.tenant
        if not tenant:
            continue
        unit = lease.unit
        if not unit:
            continue
        prop = db.query(Property).filter(Property.id == unit.property_id).first()
        if not prop:
            continue
        org = db.query(Organisation).filter(Organisation.id == prop.organisation_id).first()
        if not org:
            continue

        for days in trigger_days:
            target_date = today + timedelta(days=days)
            payment = db.query(RentPayment).filter(
                RentPayment.lease_id == lease.id,
                RentPayment.due_date == target_date,
                RentPayment.status != "paid",
            ).first()
            if not payment:
                continue

            # 1. Email (primary)
            if tenant.email:
                send_rent_reminder(tenant, payment, lease, unit, prop, org, days)

            # 2. WhatsApp (if number stored)
            if tenant.whatsapp_number:
                wa.send_whatsapp(
                    tenant.whatsapp_number,
                    _whatsapp_reminder_text(tenant, payment, prop, unit, days),
                )

            # 3. SMS — only if tenant has no email AND no WhatsApp (last resort)
            if not tenant.email and not tenant.whatsapp_number and tenant.phone:
                sm.send_sms(
                    tenant.phone,
                    _whatsapp_reminder_text(tenant, payment, prop, unit, days),
                )

            # 4. In-portal notification (always, regardless of channel)
            if tenant.portal_enabled:
                notif = TenantNotification(
                    tenant_id=tenant.id,
                    message=_whatsapp_reminder_text(tenant, payment, prop, unit, days),
                    type=_notification_type(days),
                )
                db.add(notif)

    db.commit()
