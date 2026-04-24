"""
Telegram notification service for PropAIrty.
Sends alerts for: overdue rent, expiring compliance certs, open maintenance.
"""
import os
import httpx
from datetime import date, timedelta
from sqlalchemy.orm import Session

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
COMPLIANCE_WARN_DAYS = 30


def send(message: str, chat_id: str = None) -> bool:
    """Send a Telegram message. Returns True on success."""
    token = BOT_TOKEN
    cid = chat_id or CHAT_ID
    if not token or not cid:
        print(f"[Notifications] Telegram not configured — would have sent: {message[:80]}")
        return False
    try:
        r = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": cid, "text": message, "parse_mode": "HTML"},
            timeout=10
        )
        return r.status_code == 200
    except Exception as e:
        print(f"[Notifications] Telegram send failed: {e}")
        return False


def check_rent_arrears(db: Session):
    from app.models.payment import RentPayment
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.tenant import Tenant

    overdue = db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
        RentPayment.status.in_(["overdue", "partial"])
    ).all()

    if not overdue:
        return

    lines = [f"<b>💷 PropAIrty — Rent Arrears Alert</b>\n{len(overdue)} overdue payment(s):\n"]
    total = 0
    for p in overdue:
        lease = db.query(Lease).filter(Lease.id == p.lease_id).first()
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first() if lease else None
        owed = p.amount_due - (p.amount_paid or 0)
        total += owed
        days = (date.today() - p.due_date).days
        lines.append(
            f"• <b>{tenant.full_name if tenant else 'Unknown'}</b> — "
            f"{unit.property.name + ' · ' + unit.name if unit else 'Unknown'}\n"
            f"  Due {p.due_date} ({days}d ago) — £{owed:.2f} owed"
        )
    lines.append(f"\n<b>Total arrears: £{total:.2f}</b>")
    send("\n".join(lines))


def check_compliance_expiry(db: Session):
    from app.models.compliance import ComplianceCertificate, CERT_TYPES
    from app.models.property import Property

    today = date.today()
    warn_date = today + timedelta(days=COMPLIANCE_WARN_DAYS)

    # Expired
    expired = db.query(ComplianceCertificate).join(Property).filter(
        ComplianceCertificate.expiry_date < today
    ).all()

    # Expiring soon
    expiring = db.query(ComplianceCertificate).join(Property).filter(
        ComplianceCertificate.expiry_date >= today,
        ComplianceCertificate.expiry_date <= warn_date
    ).all()

    if not expired and not expiring:
        return

    lines = ["<b>📋 PropAIrty — Compliance Alert</b>\n"]

    if expired:
        lines.append(f"<b>⛔ {len(expired)} EXPIRED certificate(s):</b>")
        for c in expired:
            label = CERT_TYPES.get(c.cert_type, {}).get("label", c.cert_type)
            lines.append(f"• {c.property.name} — {label} (expired {c.expiry_date})")

    if expiring:
        lines.append(f"\n<b>⚠️ {len(expiring)} expiring within {COMPLIANCE_WARN_DAYS} days:</b>")
        for c in expiring:
            label = CERT_TYPES.get(c.cert_type, {}).get("label", c.cert_type)
            days_left = (c.expiry_date - today).days
            lines.append(f"• {c.property.name} — {label} (expires {c.expiry_date}, {days_left}d)")

    send("\n".join(lines))


def check_open_maintenance(db: Session):
    from app.models.maintenance import MaintenanceRequest
    from app.models.unit import Unit
    from app.models.property import Property

    urgent = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.status == "open",
        MaintenanceRequest.priority.in_(["high", "urgent"])
    ).all()

    if not urgent:
        return

    lines = [f"<b>🔧 PropAIrty — Urgent Maintenance</b>\n{len(urgent)} high/urgent open issue(s):\n"]
    for r in urgent:
        unit = db.query(Unit).join(Property).filter(Unit.id == r.unit_id).first()
        lines.append(
            f"• [{r.priority.upper()}] <b>{r.title}</b>\n"
            f"  {unit.property.name + ' · ' + unit.name if unit else 'Unknown'}"
        )
    send("\n".join(lines))


def send_photo(image_path: str, caption: str = "", chat_id: str = None) -> bool:
    token = BOT_TOKEN
    cid = chat_id or CHAT_ID
    if not token or not cid:
        return False
    try:
        with open(image_path, "rb") as f:
            r = httpx.post(
                f"https://api.telegram.org/bot{token}/sendPhoto",
                data={"chat_id": cid, "caption": caption, "parse_mode": "HTML"},
                files={"photo": f},
                timeout=20,
            )
        return r.status_code == 200
    except Exception as e:
        print(f"[Notifications] sendPhoto failed: {e}")
        return False


def send_video(video_path: str, caption: str = "", chat_id: str = None) -> bool:
    token = BOT_TOKEN
    cid = chat_id or CHAT_ID
    if not token or not cid:
        return False
    try:
        with open(video_path, "rb") as f:
            r = httpx.post(
                f"https://api.telegram.org/bot{token}/sendVideo",
                data={"chat_id": cid, "caption": caption, "parse_mode": "HTML"},
                files={"video": f},
                timeout=60,
            )
        return r.status_code == 200
    except Exception as e:
        print(f"[Notifications] sendVideo failed: {e}")
        return False


def send_audio(audio_path: str, caption: str = "", chat_id: str = None) -> bool:
    token = BOT_TOKEN
    cid = chat_id or CHAT_ID
    if not token or not cid:
        return False
    try:
        with open(audio_path, "rb") as f:
            r = httpx.post(
                f"https://api.telegram.org/bot{token}/sendAudio",
                data={"chat_id": cid, "caption": caption, "parse_mode": "HTML"},
                files={"audio": f},
                timeout=30,
            )
        return r.status_code == 200
    except Exception as e:
        print(f"[Notifications] sendAudio failed: {e}")
        return False


def notify_new_maintenance(title: str, unit_name: str, priority: str, reported_by: str = ""):
    """Call this immediately when a new maintenance request is created."""
    icon = "🚨" if priority in ("high", "urgent") else "🔧"
    msg = (
        f"{icon} <b>New Maintenance Request</b>\n\n"
        f"<b>{title}</b>\n"
        f"Unit: {unit_name}\n"
        f"Priority: {priority.upper()}"
    )
    if reported_by:
        msg += f"\nReported by: {reported_by}"
    send(msg)


def check_lease_renewals(db: Session):
    """Alert on leases expiring in exactly 90, 60, or 30 days — tiered urgency."""
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property

    today = date.today()
    thresholds = [90, 60, 30]

    alerts = {}  # threshold → list of leases
    for days in thresholds:
        target = today + timedelta(days=days)
        leases = db.query(Lease).join(Unit).join(Property).filter(
            Lease.status == "active",
            Lease.end_date == target,
            Lease.is_periodic == False,
        ).all()
        if leases:
            alerts[days] = leases

    if not alerts:
        return

    for days, leases in sorted(alerts.items()):
        icon = "🚨" if days <= 30 else ("⚠️" if days <= 60 else "📅")
        lines = [f"{icon} <b>Lease Renewal Alert — {days} days to expiry</b>\n"]
        for lease in leases:
            unit = lease.unit
            prop = unit.property if unit else None
            tenant = lease.tenant
            lines.append(
                f"• <b>{tenant.full_name if tenant else 'Unknown'}</b>\n"
                f"  {prop.name + ' · ' + unit.name if prop and unit else 'Unknown'}\n"
                f"  Expires: {lease.end_date} · £{lease.monthly_rent:,.0f}/mo"
            )
        lines.append(f"\nLog in to send a renewal offer: propairty.co.uk/renewals")
        send("\n".join(lines))


def check_compliance_expiry_tiered(db: Session):
    """Extended compliance check with 60/30/7 day tiers (replaces single-threshold check)."""
    from app.models.compliance import ComplianceCertificate, CERT_TYPES
    from app.models.property import Property

    today = date.today()
    thresholds = [60, 30, 7]

    # Expired (send daily until resolved)
    expired = db.query(ComplianceCertificate).join(Property).filter(
        ComplianceCertificate.expiry_date < today
    ).all()

    if expired:
        lines = [f"⛔ <b>Compliance — EXPIRED Certificates</b>\n"]
        for c in expired:
            label = CERT_TYPES.get(c.cert_type, {}).get("label", c.cert_type)
            days_ago = (today - c.expiry_date).days
            lines.append(f"• {c.property.name} — {label}\n  Expired {c.expiry_date} ({days_ago}d ago)")
        send("\n".join(lines))

    # Expiring soon — only on specific threshold days
    for days in thresholds:
        target = today + timedelta(days=days)
        expiring = db.query(ComplianceCertificate).join(Property).filter(
            ComplianceCertificate.expiry_date == target
        ).all()
        if expiring:
            icon = "🚨" if days <= 7 else "⚠️"
            lines = [f"{icon} <b>Compliance — Expiring in {days} days</b>\n"]
            for c in expiring:
                label = CERT_TYPES.get(c.cert_type, {}).get("label", c.cert_type)
                lines.append(f"• {c.property.name} — {label} (expires {c.expiry_date})")
            send("\n".join(lines))


def run_daily_checks(db: Session):
    """Run all daily alert checks. Called by scheduler."""
    check_rent_arrears(db)
    check_compliance_expiry_tiered(db)
    check_open_maintenance(db)
    check_lease_renewals(db)
