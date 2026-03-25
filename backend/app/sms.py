"""
SMS messaging via Twilio.
No-ops silently if TWILIO_* credentials are not configured.
Used as last-resort fallback when tenant has no email and no WhatsApp number.
Activate by setting TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_FROM
in .env.production.
"""
from app.config import settings


def send_sms(to: str, message: str) -> bool:
    """
    Send an SMS to a tenant.
    `to` should be a phone number in E.164 format, e.g. +447700900000
    Returns True on success, False on failure or if not configured.
    """
    if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_sms_from]):
        print(f"[SMS] Not configured — would have sent to {to}: {message[:60]}")
        return False
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(
            from_=settings.twilio_sms_from,
            to=to,
            body=message,
        )
        print(f"[SMS] Sent to {to}")
        return True
    except Exception as e:
        print(f"[SMS] Failed to send to {to}: {e}")
        return False
