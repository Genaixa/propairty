from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.auth import get_current_user
from app.models.user import User
from app.config import settings
import os
import re

router = APIRouter(prefix="/api/system", tags=["system"])

ENV_FILE = os.path.join(os.path.dirname(__file__), "../../.env.production")

# Keys exposed via the UI, grouped by category
KEY_GROUPS = {
    "email": [
        ("smtp_host",     "SMTP Host",          "mail.example.com"),
        ("smtp_port",     "SMTP Port",           "465"),
        ("smtp_user",     "SMTP Username",       "noreply@yourdomain.co.uk"),
        ("smtp_password", "SMTP Password",       ""),
        ("imap_host",     "IMAP Host",           "imap.example.com"),
        ("imap_port",     "IMAP Port",           "993"),
        ("imap_user",     "IMAP Username",       ""),
        ("imap_password", "IMAP Password",       ""),
    ],
    "ai": [
        ("anthropic_api_key", "Anthropic API Key", "sk-ant-..."),
        ("groq_api_key",      "Groq API Key",       "gsk_..."),
        ("mistral_api_key",   "Mistral API Key",    ""),
        ("pexels_api_key",    "Pexels API Key",     ""),
    ],
    "payments": [
        ("stripe_secret_key",      "Stripe Secret Key",      "sk_live_..."),
        ("stripe_publishable_key", "Stripe Publishable Key", "pk_live_..."),
        ("stripe_webhook_secret",  "Stripe Webhook Secret",  "whsec_..."),
        ("stripe_price_id",        "Stripe Price ID",         "price_..."),
    ],
    "communications": [
        ("twilio_account_sid",   "Twilio Account SID",     "AC..."),
        ("twilio_auth_token",    "Twilio Auth Token",      ""),
        ("twilio_whatsapp_from", "Twilio WhatsApp Number", "whatsapp:+14155238886"),
        ("twilio_sms_from",      "Twilio SMS Number",      "+14155238886"),
        ("telegram_bot_token",   "Telegram Bot Token",     ""),
        ("telegram_chat_id",     "Telegram Chat ID",       ""),
    ],
    "oauth": [
        ("google_client_id",       "Google Client ID",       ""),
        ("google_client_secret",   "Google Client Secret",   ""),
        ("microsoft_client_id",    "Microsoft Client ID",    ""),
        ("microsoft_client_secret","Microsoft Client Secret",""),
    ],
}

# Keys that are "set" if non-empty (skip port numbers which always have defaults)
SKIP_CONFIGURED_CHECK = {"smtp_port", "imap_port"}


def _read_env() -> dict:
    """Parse .env.production into a dict."""
    env = {}
    path = os.path.abspath(ENV_FILE)
    if not os.path.exists(path):
        return env
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


def _write_env(updates: dict):
    """Update or add keys in .env.production."""
    path = os.path.abspath(ENV_FILE)
    lines = []
    if os.path.exists(path):
        with open(path, "r") as f:
            lines = f.readlines()

    written = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            env_key = key.upper()
            if env_key in updates:
                new_lines.append(f"{env_key}={updates[env_key]}\n")
                written.add(env_key)
                continue
        new_lines.append(line)

    # Append any keys not already in the file
    for env_key, val in updates.items():
        if env_key not in written:
            new_lines.append(f"{env_key}={val}\n")

    with open(path, "w") as f:
        f.writelines(new_lines)


def _apply_to_settings(updates: dict):
    """Apply new values to the live settings object."""
    field_map = {
        "SMTP_HOST": "smtp_host", "SMTP_PORT": "smtp_port",
        "SMTP_USER": "smtp_user", "SMTP_PASSWORD": "smtp_password",
        "SMTP_FROM": "smtp_from",
        "IMAP_HOST": "imap_host", "IMAP_PORT": "imap_port",
        "IMAP_USER": "imap_user", "IMAP_PASSWORD": "imap_password",
        "GOOGLE_CLIENT_ID": "google_client_id", "GOOGLE_CLIENT_SECRET": "google_client_secret",
        "MICROSOFT_CLIENT_ID": "microsoft_client_id", "MICROSOFT_CLIENT_SECRET": "microsoft_client_secret",
        "STRIPE_SECRET_KEY": "stripe_secret_key", "STRIPE_WEBHOOK_SECRET": "stripe_webhook_secret",
        "STRIPE_PUBLISHABLE_KEY": "stripe_publishable_key", "STRIPE_PRICE_ID": "stripe_price_id",
        "TWILIO_ACCOUNT_SID": "twilio_account_sid", "TWILIO_AUTH_TOKEN": "twilio_auth_token",
        "TWILIO_WHATSAPP_FROM": "twilio_whatsapp_from", "TWILIO_SMS_FROM": "twilio_sms_from",
        "PEXELS_API_KEY": "pexels_api_key", "GROQ_API_KEY": "groq_api_key",
        "ANTHROPIC_API_KEY": "anthropic_api_key", "MISTRAL_API_KEY": "mistral_api_key",
        "TELEGRAM_BOT_TOKEN": "telegram_bot_token", "TELEGRAM_CHAT_ID": "telegram_chat_id",
    }
    for env_key, val in updates.items():
        attr = field_map.get(env_key)
        if attr and hasattr(settings, attr):
            try:
                setattr(settings, attr, int(val) if attr in ("smtp_port", "imap_port") else val)
            except Exception:
                pass


@router.get("/api-keys")
def get_api_key_status(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")

    env = _read_env()
    result = {}
    for group, keys in KEY_GROUPS.items():
        result[group] = []
        for field, label, placeholder in keys:
            env_key = field.upper()
            val = env.get(env_key, "")
            configured = bool(val) and field not in SKIP_CONFIGURED_CHECK
            result[group].append({
                "field": field,
                "label": label,
                "placeholder": placeholder,
                "configured": configured,
            })
    return result


class TestSmsRequest(BaseModel):
    to: str
    message: str = "Test message from PropAIrty — SMS is working correctly."


@router.post("/test-sms")
def test_sms(body: TestSmsRequest, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    from app import sms
    ok = sms.send_sms(body.to, body.message)
    if ok:
        return {"ok": True, "message": f"SMS sent to {body.to}"}
    return {"ok": False, "message": "SMS not sent — check Twilio credentials in Settings."}


class ApiKeyUpdate(BaseModel):
    updates: dict  # { "field_name": "new_value" }


@router.post("/api-keys")
def save_api_keys(body: ApiKeyUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")

    # Convert field names to ENV_KEY format and filter empty values
    env_updates = {}
    for field, val in body.updates.items():
        if val and val.strip():
            env_updates[field.upper()] = val.strip()

    if not env_updates:
        return {"message": "No changes to save"}

    _write_env(env_updates)
    _apply_to_settings(env_updates)
    return {"message": f"Saved {len(env_updates)} key(s). Changes are live immediately."}
