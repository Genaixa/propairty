"""
WhatsApp Business messaging via Twilio.
No-ops silently if TWILIO_* credentials are not configured.
Activate by setting TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM
in .env.production.
"""
from app.config import settings


def send_whatsapp(to: str, message: str) -> bool:
    """
    Send a WhatsApp message to a tenant.
    `to` should be a phone number in E.164 format, e.g. +447700900000
    Returns True on success, False on failure or if not configured.
    """
    if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_whatsapp_from]):
        print(f"[WhatsApp] Not configured — would have sent to {to}: {message[:60]}")
        return False
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(
            from_=settings.twilio_whatsapp_from,
            to=f"whatsapp:{to}",
            body=message,
        )
        print(f"[WhatsApp] Sent to {to}")
        return True
    except Exception as e:
        print(f"[WhatsApp] Failed to send to {to}: {e}")
        return False
