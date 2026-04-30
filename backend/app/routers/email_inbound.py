"""
Inbound message routing — all channels feed the same AI triage queue:
  Email:
    POST /api/inbound/webhook/{token}   — Mailgun/Cloudflare email webhook
    GET  /api/inbound/settings          — connection status + addresses
    POST /api/inbound/gmail/connect     — Gmail OAuth
    GET  /api/inbound/gmail/callback
    DELETE /api/inbound/gmail
    POST /api/inbound/outlook/connect   — Outlook OAuth
    GET  /api/inbound/outlook/callback
    DELETE /api/inbound/outlook
  SMS / WhatsApp (Twilio):
    POST /api/inbound/sms               — Twilio SMS webhook
    POST /api/inbound/whatsapp          — Twilio WhatsApp webhook
  Telegram:
    POST /api/inbound/telegram          — Telegram Bot webhook
    POST /api/inbound/telegram/register — Call setWebhook on Telegram API
"""
import logging
import re
import secrets
import tempfile

log = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.organisation import Organisation
from app.models.user import User

router = APIRouter(prefix="/api/inbound", tags=["inbound"])

GOOGLE_TOKEN_URL   = "https://oauth2.googleapis.com/token"
GOOGLE_AUTH_URL    = "https://accounts.google.com/o/oauth2/v2/auth"
MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
REDIRECT_BASE = settings.app_base_url + "/api/inbound"


# ── Core triage helper ────────────────────────────────────────────────────────

def _run_triage(
    org_id: int,
    source: str,          # "email" | "sms" | "whatsapp" | "telegram"
    from_handle: str,     # email address or phone number or @username
    from_name: str | None,
    subject: str,
    body: str,
    db: Session,
    extra_profile: dict = None,   # merged into sender_profile (e.g. telegram_chat_id)
):
    """AI-triage an inbound message and persist to triage_items."""
    from app.routers.intelligence import _claude
    from app.models.triage_item import TriageItem
    from app.models.tenant import Tenant
    from app.models.landlord import Landlord
    from app.models.lease import Lease
    from app.models.maintenance import MaintenanceRequest
    from app.models.property import Property
    import json, re as _re

    # ── Identify sender by email or phone ────────────────────────────────────
    sender_profile = None
    tenant = landlord = None

    if "@" in from_handle:
        tenant = db.query(Tenant).filter(
            Tenant.organisation_id == org_id, Tenant.email == from_handle
        ).first()
        if not tenant:
            landlord = db.query(Landlord).filter(
                Landlord.organisation_id == org_id, Landlord.email == from_handle
            ).first()
    else:
        # Phone lookup — strip spaces/dashes, try E.164 and local variants
        clean = re.sub(r"[\s\-\(\)]", "", from_handle).lstrip("+")
        tenant = db.query(Tenant).filter(Tenant.organisation_id == org_id).all()
        tenant = next(
            (t for t in tenant if t.phone and re.sub(r"[\s\-\(\)]", "", t.phone).lstrip("+") == clean),
            None,
        )
        if not tenant:
            all_ll = db.query(Landlord).filter(Landlord.organisation_id == org_id).all()
            landlord = next(
                (l for l in all_ll if l.phone and re.sub(r"[\s\-\(\)]", "", l.phone).lstrip("+") == clean),
                None,
            )

    sender_context = ""
    if tenant:
        lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
        unit = lease.unit if lease else None
        prop = unit.property if unit else None
        open_jobs = db.query(MaintenanceRequest).filter(
            MaintenanceRequest.reported_by_tenant_id == tenant.id,
            MaintenanceRequest.status.notin_(["completed", "cancelled"]),
        ).count()
        sender_profile = {
            "type": "tenant", "id": tenant.id, "name": tenant.full_name,
            "email": tenant.email, "phone": tenant.phone,
            "property": prop.name if prop else None,
            "property_id": prop.id if prop else None,
            "unit": unit.name if unit else None,
            "unit_id": unit.id if unit else None,
            "lease_id": lease.id if lease else None,
            "monthly_rent": lease.monthly_rent if lease else None,
            "lease_end": str(lease.end_date) if lease and lease.end_date else None,
            "open_maintenance": open_jobs,
        }
        sender_context = f"\nSENDER IS TENANT: {tenant.full_name}, property: {prop.name if prop else 'unknown'}\n"
    elif landlord:
        props = db.query(Property).filter(Property.landlord_id == landlord.id).all()
        sender_profile = {
            "type": "landlord", "id": landlord.id, "name": landlord.full_name,
            "email": landlord.email, "properties": [p.name for p in props],
        }
        sender_context = f"\nSENDER IS LANDLORD: {landlord.full_name}\n"

    channel_label = {"email": "email", "sms": "SMS", "whatsapp": "WhatsApp message", "telegram": "Telegram message"}.get(source, "message")

    prompt = f"""You are the inbox assistant for a UK letting agency. Triage this inbound {channel_label}.
{sender_context}
From: {from_handle}{(' (' + from_name + ')') if from_name else ''}
Subject: {subject or '(none)'}
Message: {body[:3000]}

Return JSON only:
{{
  "category": "maintenance_request|rent_query|tenancy_enquiry|renewal_query|complaint|contractor_update|landlord_query|notice_to_quit|legal_notice|other",
  "confidence": 0-100,
  "urgency": "low|medium|high|urgent",
  "summary": "One sentence summary",
  "suggested_reply": "Professional warm reply using sender first name if known. 2-4 sentences.",
  "action_items": ["action 1"]
}}"""

    raw = _claude(prompt, max_tokens=1000)
    try:
        match = _re.search(r'\{.*\}', raw, _re.DOTALL)
        data = json.loads(match.group()) if match else {}
    except Exception:
        data = {}

    if extra_profile and sender_profile is not None:
        sender_profile.update(extra_profile)
    elif extra_profile:
        sender_profile = extra_profile

    resolved_name = (
        sender_profile.get("name") if sender_profile
        else from_name or from_handle.split("@")[0]
    )

    item = TriageItem(
        organisation_id=org_id,
        source=source,
        from_name=resolved_name,
        from_email=from_handle,
        subject=subject or f"Inbound {channel_label}",
        body=body[:2000],
        category=data.get("category"),
        confidence=data.get("confidence"),
        urgency=data.get("urgency"),
        summary=data.get("summary"),
        suggested_reply=data.get("suggested_reply"),
        action_items=data.get("action_items"),
        sender_profile=sender_profile,
        records_created=[],
        status="pending",
    )
    db.add(item)
    db.commit()
    return item


# ── Email webhook (Mailgun / Cloudflare) ──────────────────────────────────────

@router.post("/webhook/{token}")
async def email_webhook(token: str, request: Request, db: Session = Depends(get_db)):
    """Accept forwarded email via webhook."""
    org = db.query(Organisation).filter(Organisation.inbound_email_token == token).first()
    if not org:
        raise HTTPException(status_code=404, detail="Invalid token")

    content_type = request.headers.get("content-type", "")
    if "form" in content_type:
        form = await request.form()
        from_raw = str(form.get("sender") or form.get("from") or "")
        subject  = str(form.get("subject") or "")
        body     = str(form.get("body-plain") or form.get("stripped-text") or form.get("body") or "")
    else:
        data = await request.json()
        from_raw = data.get("from") or data.get("sender") or ""
        subject  = data.get("subject") or ""
        body     = data.get("body") or data.get("text") or ""

    m = re.search(r'<([^>]+)>', from_raw)
    from_email = m.group(1) if m else from_raw
    from_email = from_email.lower().strip()

    if not body:
        return {"ok": True, "skipped": "no body"}

    _run_triage(org.id, "email", from_email, None, subject, body, db)
    return {"ok": True}


# ── SMS webhook (Twilio) ──────────────────────────────────────────────────────

@router.post("/sms")
async def sms_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Twilio SMS inbound webhook.
    Configure in Twilio console → Phone Numbers → your SMS number → Messaging webhook (HTTP POST).
    URL: https://propairty.co.uk/api/inbound/sms
    """
    form = await request.form()
    from_number = str(form.get("From", "")).strip()
    body        = str(form.get("Body", "")).strip()

    if not body or not from_number:
        return Response(content="<?xml version='1.0'?><Response/>", media_type="application/xml")

    # Look up which org owns this Twilio number
    org = _org_for_twilio_number(str(form.get("To", "")), db)
    if org:
        _run_triage(org.id, "sms", from_number, None, "", body, db)

    # Twilio requires a TwiML response — empty = no auto-reply
    return Response(
        content="<?xml version='1.0' encoding='UTF-8'?><Response/>",
        media_type="application/xml",
    )


# ── WhatsApp webhook (Twilio) ─────────────────────────────────────────────────

@router.post("/whatsapp")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Twilio WhatsApp inbound webhook.
    Configure in Twilio console → Messaging → WhatsApp sandbox → When a message comes in (HTTP POST).
    URL: https://propairty.co.uk/api/inbound/whatsapp
    """
    form = await request.form()
    from_raw = str(form.get("From", "")).strip()   # e.g. "whatsapp:+447700900000"
    body     = str(form.get("Body", "")).strip()
    profile  = str(form.get("ProfileName", "")).strip() or None

    # Strip "whatsapp:" prefix
    from_number = from_raw.replace("whatsapp:", "").strip()

    org = _org_for_twilio_number(str(form.get("To", "")), db)
    if not org:
        return Response(content="<?xml version='1.0' encoding='UTF-8'?><Response/>", media_type="application/xml")

    # ── Media attachments — run AI visual triage on images ────────────────────
    num_media = int(form.get("NumMedia", "0") or "0")
    triage_summary = ""
    if num_media > 0:
        from app.vision_triage import run_visual_triage_from_bytes, format_triage_reply
        for i in range(min(num_media, 3)):
            media_url  = str(form.get(f"MediaUrl{i}", "")).strip()
            media_mime = str(form.get(f"MediaContentType{i}", "image/jpeg")).strip()
            if not media_url or not media_mime.startswith("image/"):
                continue
            try:
                import httpx
                # Twilio requires Basic auth to download its media
                twilio_sid    = getattr(settings, "twilio_account_sid", None)
                twilio_token  = getattr(settings, "twilio_auth_token", None)
                async with httpx.AsyncClient(timeout=30) as client:
                    if twilio_sid and twilio_token:
                        r = await client.get(media_url, auth=(twilio_sid, twilio_token))
                    else:
                        r = await client.get(media_url)
                    if r.status_code == 200:
                        triage = run_visual_triage_from_bytes(r.content, media_mime)
                        if triage:
                            triage_summary = (
                                f"[Photo via WhatsApp] AI Diagnosis: {triage.get('diagnosis','')} "
                                f"(severity: {triage.get('severity','')}, "
                                f"contractor_needed: {triage.get('contractor_needed','')})"
                            )
                            break
            except Exception as exc:
                log.warning("WhatsApp media download failed: %s", exc)

    # Combine body text with any triage summary for the triage item
    triage_body = "\n".join(filter(None, [body, triage_summary])) or "[Photo only — no text]"

    if body or triage_summary:
        _run_triage(org.id, "whatsapp", from_number, profile, "", triage_body, db)

    return Response(
        content="<?xml version='1.0' encoding='UTF-8'?><Response/>",
        media_type="application/xml",
    )


# ── Telegram webhook ──────────────────────────────────────────────────────────

@router.post("/telegram")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Telegram Bot API inbound webhook. Register via POST /api/inbound/telegram/register.
    Routes inventory-related sessions to the guided inventory bot;
    everything else falls through to the AI triage system.
    """
    try:
        update = await request.json()
    except Exception:
        return {"ok": True}

    message = update.get("message") or update.get("edited_message")
    if not message:
        return {"ok": True}

    sender    = message.get("from", {})
    chat_id   = str(message.get("chat", {}).get("id", ""))
    username  = sender.get("username") or chat_id
    from_name = " ".join(filter(None, [sender.get("first_name"), sender.get("last_name")])) or username

    from app.models.organisation import Organisation as Org
    org = db.query(Org).first()
    if not org:
        return {"ok": True}

    from app.telegram_inventory import get_active_session, handle_telegram_message, handle_telegram_photo

    # ── Photos: inventory session OR visual maintenance triage ───────────────
    photos = message.get("photo")
    if photos:
        has_session = get_active_session(chat_id, org.id, db) is not None
        best = photos[-1]  # highest-resolution is last in Telegram's array
        photo_bytes, ext = await _download_telegram_file(best.get("file_id", ""))
        if has_session:
            if photo_bytes:
                reply = await handle_telegram_photo(chat_id, photo_bytes, ext, org, db)
                if reply:
                    await _telegram_send(chat_id, reply)
            return {"ok": True}

        # Not an inventory session — run AI visual triage on the photo
        if photo_bytes:
            from app.vision_triage import run_visual_triage_from_bytes, format_triage_reply
            mime = f"image/{ext.lstrip('.') or 'jpeg'}"
            triage = run_visual_triage_from_bytes(photo_bytes, mime)
            if triage:
                reply = format_triage_reply(triage)
                await _telegram_send(chat_id, reply)
                # Also log as a triage item so agents can see it
                _run_triage(
                    org.id, "telegram", f"@{username}", from_name,
                    "Photo: maintenance issue",
                    f"[Photo sent via Telegram]\nAI Diagnosis: {triage.get('diagnosis','')} "
                    f"(severity: {triage.get('severity','')}, contractor_needed: {triage.get('contractor_needed','')})",
                    db,
                    extra_profile={"telegram_chat_id": chat_id},
                )
            else:
                await _telegram_send(chat_id, "📸 Photo received — your letting agent will review it shortly.")
        return {"ok": True}

    # ── Resolve text — transcribe voice notes if needed ───────────────────────
    text = message.get("text", "").strip()
    voice = message.get("voice") or message.get("audio")
    if not text and voice:
        text = await _transcribe_telegram_voice(voice.get("file_id", ""))

    if not text:
        return {"ok": True}

    # ── Handle /link CODE — portal notification linking ───────────────────────
    link_match = re.match(r"^/link\s+([A-F0-9]{8})\s*$", text.strip(), re.IGNORECASE)
    if link_match:
        code = link_match.group(1).upper()
        from app.models.tenant import Tenant as _Tenant
        from app.models.landlord import Landlord as _Landlord
        from app.models.contractor import Contractor as _Contractor
        matched = None
        entity_label = ""
        for Model, label in [(_Tenant, "tenant"), (_Landlord, "landlord"), (_Contractor, "contractor")]:
            found = db.query(Model).filter(Model.telegram_link_code == code).first()
            if found:
                matched = found
                entity_label = label
                break
        if matched:
            matched.telegram_chat_id = chat_id
            db.commit()
            reply = (
                f"✅ Linked! Hi {matched.full_name.split()[0]}, your Telegram account is now connected.\n\n"
                f"You'll receive a message here whenever your property manager sends you a new message in your portal."
            )
        else:
            reply = "❌ Code not recognised. Please copy the code exactly from your portal notification settings."
        await _telegram_send(chat_id, reply)
        return {"ok": True}

    # ── Route to inventory bot if session active or message looks inventory-related ──
    has_session = get_active_session(chat_id, org.id, db) is not None
    inventory_keywords = re.compile(
        r"\b(inventory|check.?in|check.?out|inspect|im at|i'm at|at property|"
        r"flat|apartment|house|street|avenue|road|lane|/inventory)\b",
        re.IGNORECASE,
    )
    is_inventory_msg = has_session or bool(inventory_keywords.search(text))

    if is_inventory_msg:
        reply = handle_telegram_message(chat_id, text, org, db)
        await _telegram_send(chat_id, reply)
        return {"ok": True}

    # ── Fall through to existing triage system ────────────────────────────────
    _run_triage(org.id, "telegram", f"@{username}", from_name, "", text, db,
                extra_profile={"telegram_chat_id": chat_id})

    return {"ok": True}


async def _download_telegram_file(file_id: str):
    """Download any file from Telegram. Returns (bytes, ext) or (None, '')."""
    if not file_id or not settings.telegram_bot_token:
        return None, ""
    try:
        import httpx
        token = settings.telegram_bot_token
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}")
            file_path = r.json().get("result", {}).get("file_path", "")
            if not file_path:
                return None, ""
            dl = await client.get(f"https://api.telegram.org/file/bot{token}/{file_path}")
            ext = "." + file_path.rsplit(".", 1)[-1] if "." in file_path else ""
            return dl.content, ext
    except Exception as e:
        print(f"[TelegramDownload] Failed for file_id {file_id}: {e}")
        return None, ""


async def _transcribe_telegram_voice(file_id: str) -> str:
    """Download a Telegram voice file and transcribe it with Whisper via Groq."""
    if not file_id or not settings.telegram_bot_token:
        return ""
    try:
        audio_bytes, ext = await _download_telegram_file(file_id)
        if not audio_bytes:
            return ""

        from openai import OpenAI
        client_oai = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=settings.groq_api_key,
        )
        with tempfile.NamedTemporaryFile(suffix=ext or ".ogg", delete=False) as f:
            f.write(audio_bytes)
            tmp = f.name
        try:
            with open(tmp, "rb") as f:
                result = client_oai.audio.transcriptions.create(
                    model="whisper-large-v3-turbo",
                    file=f,
                    response_format="text",
                )
            return result if isinstance(result, str) else result.text
        finally:
            import os as _os
            _os.unlink(tmp)
    except Exception as e:
        print(f"[TelegramVoice] Transcription failed: {e}")
        return ""


async def _telegram_send(chat_id: str, text: str):
    """Send a reply message to a Telegram chat."""
    if not settings.telegram_bot_token:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
    except Exception as e:
        print(f"[TelegramSend] Failed to send to {chat_id}: {e}")


@router.post("/telegram/register")
async def telegram_register(current_user: User = Depends(get_current_user)):
    """Call Telegram setWebhook to point the bot at this server."""
    import httpx
    token = settings.telegram_bot_token
    if not token:
        raise HTTPException(status_code=501, detail="TELEGRAM_BOT_TOKEN not set in .env.production")
    webhook_url = f"{settings.app_base_url}/api/inbound/telegram"
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api.telegram.org/bot{token}/setWebhook",
            json={"url": webhook_url, "allowed_updates": ["message", "edited_message"]},
        )
    result = r.json()
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=f"Telegram error: {result.get('description')}")
    return {"ok": True, "webhook_url": webhook_url}


# ── Settings ──────────────────────────────────────────────────────────────────

@router.get("/settings")
def inbound_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    if not org.inbound_email_token:
        org.inbound_email_token = secrets.token_urlsafe(16)
        db.commit()
    return {
        # Email
        "forwarding_address": f"triage-{org.inbound_email_token}@propairty.co.uk",
        "webhook_url": f"{settings.app_base_url}/api/inbound/webhook/{org.inbound_email_token}",
        "gmail_connected": bool(org.gmail_access_token),
        "gmail_email": org.gmail_email,
        "outlook_connected": bool(org.outlook_access_token),
        "outlook_email": org.outlook_email,
        # SMS / WhatsApp
        "sms_webhook_url": f"{settings.app_base_url}/api/inbound/sms",
        "whatsapp_webhook_url": f"{settings.app_base_url}/api/inbound/whatsapp",
        "twilio_sms_number": settings.twilio_sms_from or None,
        "twilio_whatsapp_number": settings.twilio_whatsapp_from.replace("whatsapp:", "") if settings.twilio_whatsapp_from else None,
        "twilio_configured": bool(settings.twilio_account_sid and settings.twilio_auth_token),
        # Telegram
        "telegram_webhook_url": f"{settings.app_base_url}/api/inbound/telegram",
        "telegram_configured": bool(settings.telegram_bot_token),
    }


# ── Gmail OAuth ────────────────────────────────────────────────────────────────

@router.post("/gmail/connect")
def gmail_connect(current_user: User = Depends(get_current_user)):
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.production")
    from urllib.parse import urlencode
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": f"{REDIRECT_BASE}/gmail/callback",
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/gmail.readonly",
        "access_type": "offline",
        "prompt": "consent",
        "state": str(current_user.organisation_id),
    }
    return {"auth_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/gmail/callback")
async def gmail_callback(code: str, state: str, db: Session = Depends(get_db)):
    import httpx
    org = db.query(Organisation).filter(Organisation.id == int(state)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    async with httpx.AsyncClient() as client:
        r = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": f"{REDIRECT_BASE}/gmail/callback",
            "grant_type": "authorization_code",
        })
        tokens = r.json()
    async with httpx.AsyncClient() as client:
        r2 = await client.get("https://www.googleapis.com/oauth2/v2/userinfo",
                               headers={"Authorization": f"Bearer {tokens.get('access_token')}"})
        info = r2.json()
    org.gmail_access_token  = tokens.get("access_token")
    org.gmail_refresh_token = tokens.get("refresh_token")
    org.gmail_email         = info.get("email")
    db.commit()
    return RedirectResponse(url="/email-triage?connected=gmail")


@router.delete("/gmail")
def gmail_disconnect(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    org.gmail_access_token = None
    org.gmail_refresh_token = None
    org.gmail_email = None
    db.commit()
    return {"ok": True}


# ── Outlook OAuth ─────────────────────────────────────────────────────────────

@router.post("/outlook/connect")
def outlook_connect(current_user: User = Depends(get_current_user)):
    if not settings.microsoft_client_id:
        raise HTTPException(status_code=501, detail="Microsoft OAuth not configured — add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to .env.production")
    from urllib.parse import urlencode
    params = {
        "client_id": settings.microsoft_client_id,
        "response_type": "code",
        "redirect_uri": f"{REDIRECT_BASE}/outlook/callback",
        "scope": "https://graph.microsoft.com/Mail.Read offline_access",
        "state": str(current_user.organisation_id),
    }
    auth_url = MICROSOFT_AUTH_URL.format(tenant=settings.microsoft_tenant_id)
    return {"auth_url": f"{auth_url}?{urlencode(params)}"}


@router.get("/outlook/callback")
async def outlook_callback(code: str, state: str, db: Session = Depends(get_db)):
    import httpx
    org = db.query(Organisation).filter(Organisation.id == int(state)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    token_url = MICROSOFT_TOKEN_URL.format(tenant=settings.microsoft_tenant_id)
    async with httpx.AsyncClient() as client:
        r = await client.post(token_url, data={
            "code": code,
            "client_id": settings.microsoft_client_id,
            "client_secret": settings.microsoft_client_secret,
            "redirect_uri": f"{REDIRECT_BASE}/outlook/callback",
            "grant_type": "authorization_code",
            "scope": "https://graph.microsoft.com/Mail.Read offline_access",
        })
        tokens = r.json()
    async with httpx.AsyncClient() as client:
        r2 = await client.get("https://graph.microsoft.com/v1.0/me",
                               headers={"Authorization": f"Bearer {tokens.get('access_token')}"})
        info = r2.json()
    org.outlook_access_token  = tokens.get("access_token")
    org.outlook_refresh_token = tokens.get("refresh_token")
    org.outlook_email         = info.get("mail") or info.get("userPrincipalName")
    db.commit()
    return RedirectResponse(url="/email-triage?connected=outlook")


@router.delete("/outlook")
def outlook_disconnect(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    org.outlook_access_token = None
    org.outlook_refresh_token = None
    org.outlook_email = None
    db.commit()
    return {"ok": True}


# ── Reply endpoint ────────────────────────────────────────────────────────────

@router.post("/reply")
async def send_reply(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Send a reply via one or more channels.
    Body: { triage_item_id, reply_text, channels: ["email","sms","whatsapp","telegram"] }
    Portal notification is always sent if sender is a known tenant.
    """
    body = await request.json()
    item_id    = body.get("triage_item_id")
    reply_text = (body.get("reply_text") or "").strip()
    channels   = body.get("channels") or []

    if not reply_text:
        raise HTTPException(status_code=400, detail="reply_text is required")

    from app.models.triage_item import TriageItem
    item = db.query(TriageItem).filter(
        TriageItem.id == item_id,
        TriageItem.organisation_id == current_user.organisation_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Triage item not found")

    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    profile = item.sender_profile or {}
    results = {}

    # ── Email ─────────────────────────────────────────────────────────────────
    if "email" in channels:
        to_email = profile.get("email") or (item.from_email if "@" in (item.from_email or "") else None)
        if to_email:
            from app.emails import _send_email, _base_template
            subject = f"Re: {item.subject}" if item.subject else "Message from your letting agent"
            html_body = f"<p>{reply_text.replace(chr(10), '<br>')}</p>"
            html = _base_template(subject, html_body, org.name if org else "Your Letting Agent")
            ok = _send_email(to_email, subject, html)
            results["email"] = {"ok": ok, "to": to_email}
        else:
            results["email"] = {"ok": False, "error": "No email address on record"}

    # ── SMS ───────────────────────────────────────────────────────────────────
    if "sms" in channels:
        phone = profile.get("phone") or (item.from_email if item.source == "sms" else None)
        if phone:
            from app import sms as sm
            ok = sm.send_sms(phone, reply_text)
            results["sms"] = {"ok": ok, "to": phone}
        else:
            results["sms"] = {"ok": False, "error": "No phone number on record"}

    # ── WhatsApp ──────────────────────────────────────────────────────────────
    if "whatsapp" in channels:
        phone = profile.get("phone") or (item.from_email if item.source == "whatsapp" else None)
        if phone:
            from app import whatsapp as wa
            ok = wa.send_whatsapp(phone, reply_text)
            results["whatsapp"] = {"ok": ok, "to": phone}
        else:
            results["whatsapp"] = {"ok": False, "error": "No phone number on record"}

    # ── Telegram ──────────────────────────────────────────────────────────────
    if "telegram" in channels:
        chat_id = profile.get("telegram_chat_id")
        if chat_id and settings.telegram_bot_token:
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                    json={"chat_id": chat_id, "text": reply_text},
                )
            ok = r.status_code == 200
            results["telegram"] = {"ok": ok, "to": profile.get("from_handle", chat_id)}
        elif not settings.telegram_bot_token:
            results["telegram"] = {"ok": False, "error": "Telegram bot not configured"}
        else:
            results["telegram"] = {"ok": False, "error": "No Telegram chat ID — message must arrive via Telegram first"}

    # ── Portal (always, if sender is a known tenant) ──────────────────────────
    if profile.get("type") == "tenant" and profile.get("id"):
        from app.models.tenant_notification import TenantNotification
        notif = TenantNotification(
            tenant_id=profile["id"],
            message=reply_text,
            type="info",
        )
        db.add(notif)
        db.commit()
        results["portal"] = {"ok": True}

    # Mark triage item as actioned
    item.status = "actioned"
    db.commit()

    return {"ok": True, "results": results}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _org_for_twilio_number(to_number: str, db: Session):
    """
    For multi-tenant: match the Twilio 'To' number to an org.
    For now returns the first org (single-tenant default).
    Extend by storing twilio_number on Organisation if needed.
    """
    from app.models.organisation import Organisation as Org
    return db.query(Org).first()
