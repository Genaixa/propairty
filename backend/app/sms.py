"""
SMS messaging via Twilio.
No-ops silently if TWILIO_* credentials are not configured.
Activate by setting TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_FROM
in .env.production.
"""
from app.config import settings


def _normalise_phone(number: str) -> str:
    """Normalise a UK phone number to E.164 format."""
    n = number.strip().replace(" ", "").replace("-", "")
    if n.startswith("07") and len(n) == 11:
        return "+44" + n[1:]
    if n.startswith("7") and len(n) == 10:
        return "+44" + n
    return n  # Already E.164 or non-UK


def send_sms(to: str, message: str) -> bool:
    """
    Send an SMS. `to` is a phone number (UK or E.164).
    Returns True on success, False on failure or if not configured.
    """
    if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_sms_from]):
        print(f"[SMS] Not configured — would have sent to {to}: {message[:60]}")
        return False
    if not to or not to.strip():
        print("[SMS] No recipient number — skipping")
        return False
    number = _normalise_phone(to)
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(
            from_=settings.twilio_sms_from,
            to=number,
            body=message,
        )
        print(f"[SMS] Sent to {number}")
        return True
    except Exception as e:
        print(f"[SMS] Failed to send to {number}: {e}")
        return False


# ── Convenience helpers ────────────────────────────────────────────────────────

def send_rent_reminder_sms(tenant_name: str, phone: str, amount: float, due_date: str) -> bool:
    first = tenant_name.split()[0] if tenant_name else "there"
    body = (
        f"Hi {first}, your rent of £{amount:,.2f} is due on {due_date}. "
        "Please pay on time to avoid late fees. — PropAIrty"
    )
    return send_sms(phone, body)


def send_maintenance_update_sms(tenant_name: str, phone: str, issue: str, new_status: str) -> bool:
    labels = {
        "open": "logged",
        "assigned": "assigned to a contractor",
        "in_progress": "now in progress",
        "completed": "completed",
        "closed": "closed",
    }
    label = labels.get(new_status, new_status.replace("_", " "))
    first = tenant_name.split()[0] if tenant_name else "there"
    body = (
        f"Hi {first}, your maintenance request '{issue[:40]}' has been {label}. "
        "Log in to your tenant portal for details. — PropAIrty"
    )
    return send_sms(phone, body)


def send_viewing_confirmation_sms(name: str, phone: str, property_addr: str, viewing_date: str) -> bool:
    first = name.split()[0] if name else "there"
    body = (
        f"Hi {first}, your viewing at {property_addr} is confirmed for {viewing_date}. "
        "Reply STOP to opt out. — PropAIrty"
    )
    return send_sms(phone, body)


def send_inspection_reminder_sms(tenant_name: str, phone: str, date_str: str, property_addr: str) -> bool:
    first = tenant_name.split()[0] if tenant_name else "there"
    body = (
        f"Hi {first}, a property inspection is booked for {date_str} at {property_addr}. "
        "Please ensure access is available. — PropAIrty"
    )
    return send_sms(phone, body)
