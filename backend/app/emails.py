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


def send_agent_new_tenant_message(agent_emails: list, tenant: "Tenant", body: str, org: "Organisation", prop_name: str = "", unit_name: str = ""):
    if not agent_emails:
        return
    safe_name = html.escape(tenant.full_name)
    safe_body = html.escape(body)
    location = f"{html.escape(prop_name)} · {html.escape(unit_name)}" if prop_name else ""
    subject = f"New message from {tenant.full_name}"
    email_body = f"""
    <h2>New tenant message</h2>
    <p><strong>{safe_name}</strong> has sent you a message{f' regarding <em>{location}</em>' if location else ''}.</p>
    <div class="amount-box">
      <div class="label">Message</div>
      <div class="amount" style="font-size:15px;line-height:1.5">{safe_body}</div>
    </div>
    <a href="{settings.app_base_url}/messages" class="cta">Reply in PropAIrty</a>
    """
    email_html = _base_template(subject, email_body, org.name)
    for email in agent_emails:
        _send_email(email, subject, email_html)


def send_tenant_agent_reply(tenant: "Tenant", agent_name: str, body: str, org: "Organisation"):
    if not tenant.email:
        return
    safe_agent = html.escape(agent_name)
    safe_body = html.escape(body)
    first = html.escape(tenant.full_name.split()[0])
    subject = f"New message from {agent_name}"
    email_body = f"""
    <h2>Message from your letting agent</h2>
    <p>Hi {first},</p>
    <p><strong>{safe_agent}</strong> at {html.escape(org.name)} has sent you a message:</p>
    <div class="amount-box">
      <div class="label">Message</div>
      <div class="amount" style="font-size:15px;line-height:1.5">{safe_body}</div>
    </div>
    <a href="{settings.app_base_url}/tenant/portal" class="cta">Reply in your tenant portal</a>
    """
    email_html = _base_template(subject, email_body, org.name)
    _send_email(tenant.email, subject, email_html)


def send_agent_maintenance_raised(agent_emails: list, tenant: "Tenant", title: str, description: str, org: "Organisation", prop_name: str = "", unit_name: str = ""):
    if not agent_emails:
        return
    safe_title = html.escape(title)
    safe_desc = html.escape(description or "")
    safe_name = html.escape(tenant.full_name)
    location = f"{html.escape(prop_name)} · {html.escape(unit_name)}" if prop_name else ""
    subject = f"New maintenance request — {title}"
    email_body = f"""
    <h2>New maintenance request</h2>
    <p><strong>{safe_name}</strong>{f' at <em>{location}</em>' if location else ''} has raised a maintenance request.</p>
    <div class="amount-box">
      <div class="label">Issue</div>
      <div class="amount" style="font-size:16px">{safe_title}</div>
    </div>
    {f'<p>{safe_desc}</p>' if safe_desc else ''}
    <a href="{settings.app_base_url}/maintenance" class="cta">View in PropAIrty</a>
    """
    email_html = _base_template(subject, email_body, org.name)
    for email in agent_emails:
        _send_email(email, subject, email_html)


def send_landlord_agent_reply(landlord, agent_name: str, body: str, org):
    if not landlord.email:
        return
    safe_agent = html.escape(agent_name)
    safe_body = html.escape(body)
    first = html.escape(landlord.full_name.split()[0])
    subject = f"New message from {agent_name}"
    email_body = f"""
    <h2>Message from your letting agent</h2>
    <p>Hi {first},</p>
    <p><strong>{safe_agent}</strong> at {html.escape(org.name if org else 'your letting agent')} has sent you a message:</p>
    <div class="amount-box">
      <div class="label">Message</div>
      <div class="amount" style="font-size:15px;line-height:1.5">{safe_body}</div>
    </div>
    <a href="{settings.app_base_url}/landlord/portal" class="cta">Reply in your landlord portal</a>
    """
    email_html = _base_template(subject, email_body, org.name if org else "PropAIrty")
    _send_email(landlord.email, subject, email_html)


def send_agent_new_landlord_message(agent_emails: list, landlord, body: str, org):
    if not agent_emails:
        return
    safe_name = html.escape(landlord.full_name)
    safe_body = html.escape(body)
    subject = f"New message from landlord {landlord.full_name}"
    email_body = f"""
    <h2>New landlord message</h2>
    <p><strong>{safe_name}</strong> has sent you a message via the landlord portal.</p>
    <div class="amount-box">
      <div class="label">Message</div>
      <div class="amount" style="font-size:15px;line-height:1.5">{safe_body}</div>
    </div>
    <a href="{settings.app_base_url}/landlord-messages" class="cta">Reply in PropAIrty</a>
    """
    email_html = _base_template(subject, email_body, org.name if org else "PropAIrty")
    for email in agent_emails:
        _send_email(email, subject, email_html)


def send_monthly_landlord_statements(db):
    """Email each landlord their previous month's rent statement as a PDF attachment."""
    import calendar as _cal
    from datetime import date
    from app.models.landlord import Landlord as LandlordModel
    from app.models.property import Property as PropertyModel
    from app.models.unit import Unit as UnitModel
    from app.models.lease import Lease as LeaseModel
    from app.models.payment import RentPayment as RentPaymentModel
    from app.models.organisation import Organisation as OrgModel
    from app import docgen as _docgen
    from email.mime.application import MIMEApplication
    import smtplib, ssl

    if not settings.smtp_host or not settings.smtp_user:
        print("[email] SMTP not configured — skipping landlord statements")
        return

    today = date.today()
    # Previous month
    if today.month == 1:
        year, month = today.year - 1, 12
    else:
        year, month = today.year, today.month - 1

    month_start = date(year, month, 1)
    month_end = date(year, month, _cal.monthrange(year, month)[1])
    report_month = month_start.strftime("%B %Y")

    landlords = db.query(LandlordModel).filter(LandlordModel.is_active == True).all()
    for landlord in landlords:
        if not landlord.email:
            continue
        props = db.query(PropertyModel).filter(PropertyModel.landlord_id == landlord.id).all()
        if not props:
            continue
        org = db.query(OrgModel).filter(OrgModel.id == landlord.organisation_id).first()

        properties_data = []
        for p in props:
            units = db.query(UnitModel).filter(UnitModel.property_id == p.id).all()
            unit_data = []
            for u in units:
                lease = db.query(LeaseModel).filter(LeaseModel.unit_id == u.id, LeaseModel.status == "active").first()
                payment = None
                if lease:
                    payment = db.query(RentPaymentModel).filter(
                        RentPaymentModel.lease_id == lease.id,
                        RentPaymentModel.due_date >= month_start,
                        RentPaymentModel.due_date <= month_end,
                    ).first()
                status = "vacant"
                if lease:
                    status = payment.status if payment else "pending"
                unit_data.append({
                    "name": u.name,
                    "tenant_name": lease.tenant.full_name if lease and lease.tenant else None,
                    "expected": payment.amount_due if payment else (lease.monthly_rent if lease else 0),
                    "collected": payment.amount_paid or 0 if payment and payment.status == "paid" else 0,
                    "status": status,
                })
            properties_data.append({
                "name": p.name,
                "address": f"{p.address_line1}, {p.city}, {p.postcode}",
                "units": unit_data,
            })

        try:
            pdf = _docgen.generate_financial_report(
                landlord, properties_data, [], [], report_month, org.name if org else "PropAIrty"
            )
        except Exception as e:
            print(f"[email] statement PDF failed for landlord {landlord.id}: {e}")
            continue

        subject = f"Your rent statement — {report_month}"
        body_html = _base_template(subject, f"""
        <h2>Monthly Rent Statement — {report_month}</h2>
        <p>Hi {html.escape(landlord.full_name.split()[0])},</p>
        <p>Please find your rent statement for <strong>{report_month}</strong> attached as a PDF.</p>
        <p>If you have any questions about this statement, please log in to your landlord portal or contact your letting agent.</p>
        <a href="{settings.app_base_url}/landlord/portal" class="cta">View landlord portal</a>
        """, org.name if org else "PropAIrty")

        try:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"] = settings.smtp_from
            msg["To"] = landlord.email
            from email.mime.multipart import MIMEMultipart as _MM
            alt = _MM("alternative")
            alt.attach(MIMEText(body_html, "html"))
            msg.attach(alt)
            filename = f"Statement-{report_month.replace(' ', '-')}.pdf"
            pdf_part = MIMEApplication(pdf, _subtype="pdf")
            pdf_part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(pdf_part)
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_user, landlord.email, msg.as_string())
            print(f"[email] Statement sent to {landlord.email} for {report_month}")
        except Exception as e:
            print(f"[email] Failed to send statement to {landlord.email}: {e}")


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


def send_void_renewal_chaser(tenant: Tenant, lease, unit: Unit, prop: Property, org: Organisation, agent_name: str):
    """Send a renewal chaser email to a tenant from the Void Minimiser."""
    if not tenant.email:
        return False
    first = tenant.full_name.split()[0]
    lease_end = lease.end_date.strftime('%d %B %Y')
    subject = f"Your tenancy at {prop.name} — renewal reminder"
    body = f"""
    <h2>Your tenancy renewal</h2>
    <p>Hi {html.escape(first)},</p>
    <p>We're reaching out regarding your tenancy at <strong>{html.escape(prop.name)}, {html.escape(unit.name)}</strong>,
    which is due to end on <strong>{lease_end}</strong>.</p>
    <p>We'd love for you to stay! Please get in touch with us as soon as possible to discuss renewing your tenancy.</p>
    <p>If you have already been in contact or have decided not to renew, please disregard this message.</p>
    <p style="margin-top:24px;">Kind regards,<br>
    <strong>{html.escape(agent_name)}</strong><br>
    {html.escape(org.name)}</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">View your tenant portal</a>
    """
    return _send_email(tenant.email, subject, _base_template(subject, body, org.name))


def send_rent_review_recommendation(landlord, unit: Unit, prop: Property, org: Organisation,
                                     current_rent: int, market_rent: int, agent_name: str):
    """Notify a landlord that one of their units is underpriced vs market rate."""
    if not landlord or not landlord.email:
        return False
    diff = market_rent - current_rent
    pct = round((diff / market_rent) * 100, 1)
    subject = f"Rent review opportunity — {prop.name}, {unit.name}"
    body = f"""
    <h2>Rent review recommendation</h2>
    <p>Hi {html.escape(landlord.full_name or 'Landlord')},</p>
    <p>We've been monitoring local market rents and wanted to flag an opportunity for
    <strong>{html.escape(prop.name)}, {html.escape(unit.name)}</strong>.</p>
    <table style="border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Current rent</td><td style="font-weight:bold;">£{current_rent:,}/mo</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Local market rate</td><td style="font-weight:bold;color:#4f46e5;">£{market_rent:,}/mo</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#6b7280;">Potential uplift</td><td style="font-weight:bold;color:#16a34a;">+£{diff:,}/mo ({pct}%)</td></tr>
    </table>
    <p>We recommend discussing a rent increase at the next renewal opportunity. We can handle this on your behalf — please get in touch if you'd like to proceed.</p>
    <p style="margin-top:24px;">Kind regards,<br>
    <strong>{html.escape(agent_name)}</strong><br>
    {html.escape(org.name)}</p>
    """
    return _send_email(landlord.email, subject, _base_template(subject, body, org.name))


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
    """Run daily — send reminders per each org's configured channels and trigger days."""
    import json as _json
    from app import whatsapp as wa, sms as sm

    DEFAULT_CHANNELS = ["email", "portal"]
    DEFAULT_DAYS = [3, 1, 0, -1, -3, -7]

    today = date.today()
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

        channels = _json.loads(org.reminder_channels) if org.reminder_channels else DEFAULT_CHANNELS
        trigger_days = _json.loads(org.reminder_days) if org.reminder_days else DEFAULT_DAYS

        for days in trigger_days:
            target_date = today + timedelta(days=days)
            payment = db.query(RentPayment).filter(
                RentPayment.lease_id == lease.id,
                RentPayment.due_date == target_date,
                RentPayment.status != "paid",
            ).first()
            if not payment:
                continue

            if "email" in channels and tenant.email:
                send_rent_reminder(tenant, payment, lease, unit, prop, org, days)

            if "whatsapp" in channels and tenant.whatsapp_number:
                wa.send_whatsapp(
                    tenant.whatsapp_number,
                    _whatsapp_reminder_text(tenant, payment, prop, unit, days),
                )

            if "sms" in channels and tenant.phone:
                sm.send_sms(
                    tenant.phone,
                    _whatsapp_reminder_text(tenant, payment, prop, unit, days),
                )

            if "portal" in channels and tenant.portal_enabled:
                notif = TenantNotification(
                    tenant_id=tenant.id,
                    message=_whatsapp_reminder_text(tenant, payment, prop, unit, days),
                    type=_notification_type(days),
                )
                db.add(notif)

    # Every-2-days overdue chase: any overdue payment not covered by trigger_days above
    overdue_payments = db.query(RentPayment).filter(
        RentPayment.due_date < today,
        RentPayment.status.in_(["overdue", "pending", "partial"]),
    ).all()

    for payment in overdue_payments:
        days_overdue = (today - payment.due_date).days
        # Skip if already handled by trigger_days today
        if -days_overdue in trigger_days:
            continue
        # Only send if never sent, or last sent 2+ days ago
        if payment.last_reminder_sent and (today - payment.last_reminder_sent).days < 2:
            continue

        lease = db.query(Lease).filter(Lease.id == payment.lease_id).first()
        if not lease or not lease.tenant:
            continue
        tenant = lease.tenant
        unit = lease.unit
        if not unit:
            continue
        prop = db.query(Property).filter(Property.id == unit.property_id).first()
        if not prop:
            continue
        org = db.query(Organisation).filter(Organisation.id == prop.organisation_id).first()
        if not org:
            continue

        channels = _json.loads(org.reminder_channels) if org.reminder_channels else DEFAULT_CHANNELS
        days_arg = -days_overdue  # negative = overdue

        if "email" in channels and tenant.email:
            send_rent_reminder(tenant, payment, lease, unit, prop, org, days_arg)
        if "whatsapp" in channels and tenant.whatsapp_number:
            wa.send_whatsapp(tenant.whatsapp_number, _whatsapp_reminder_text(tenant, payment, prop, unit, days_arg))
        if "sms" in channels and tenant.phone:
            sm.send_sms(tenant.phone, _whatsapp_reminder_text(tenant, payment, prop, unit, days_arg))
        if "portal" in channels and tenant.portal_enabled:
            notif = TenantNotification(
                tenant_id=tenant.id,
                message=_whatsapp_reminder_text(tenant, payment, prop, unit, days_arg),
                type="urgent",
            )
            db.add(notif)

        payment.last_reminder_sent = today

    db.commit()


# ── Portal message notification dispatcher ────────────────────────────────────

def send_portal_message_notification(entity, sender_name: str, body: str, org, portal_url: str):
    """
    Send a new-message notification to a tenant/landlord/contractor via their
    chosen channels (email, WhatsApp, Telegram).

    entity  — a Tenant, Landlord, or Contractor ORM object (must have the
              notify_* and contact fields added in the migration)
    """
    first = (entity.full_name or "").split()[0] or "there"
    org_name = org.name if org else "Your property management company"
    subject = f"New message from {html.escape(sender_name)} — {org_name}"
    preview = body[:120] + ("…" if len(body) > 120 else "")

    # ── Email ──────────────────────────────────────────────────────────────────
    if getattr(entity, "notify_email", False) and getattr(entity, "email", None):
        email_body = f"""
        <h2>You have a new message</h2>
        <p>Hi {html.escape(first)},</p>
        <p><strong>{html.escape(sender_name)}</strong> from {html.escape(org_name)} has sent you a message:</p>
        <div class="amount-box" style="text-align:left;padding:16px 20px;">
          <p style="margin:0;font-size:15px;color:#374151;">{html.escape(preview)}</p>
        </div>
        <p>Log in to your portal to read the full message and reply.</p>
        <a href="{portal_url}" class="cta">Open my portal</a>
        """
        _send_email(entity.email, subject, _base_template(subject, email_body, org_name))

    # ── WhatsApp ───────────────────────────────────────────────────────────────
    wa_number = getattr(entity, "whatsapp_number", None) or getattr(entity, "phone", None)
    if getattr(entity, "notify_whatsapp", False) and wa_number:
        try:
            from app import whatsapp as _wa
            wa_text = (
                f"Hi {first}, you have a new message from {sender_name} ({org_name}):\n\n"
                f"\"{preview}\"\n\n"
                f"Log in to your portal to reply: {portal_url}"
            )
            _wa.send_whatsapp(wa_number, wa_text)
        except Exception as e:
            print(f"[notify] WhatsApp failed: {e}")

    # ── Telegram ───────────────────────────────────────────────────────────────
    tg_chat_id = getattr(entity, "telegram_chat_id", None)
    if getattr(entity, "notify_telegram", False) and tg_chat_id:
        try:
            from app import notifications as _notif
            tg_text = (
                f"💬 <b>New message</b>\n\n"
                f"Hi {html.escape(first)}, <b>{html.escape(sender_name)}</b> from "
                f"{html.escape(org_name)} has sent you a message:\n\n"
                f"<i>{html.escape(preview)}</i>\n\n"
                f"<a href='{portal_url}'>Log in to reply</a>"
            )
            _notif.send(tg_text, chat_id=tg_chat_id)
        except Exception as e:
            print(f"[notify] Telegram failed: {e}")
