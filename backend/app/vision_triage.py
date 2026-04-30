"""AI visual triage for maintenance requests — analyses uploaded photos with Claude vision."""
import base64
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)
UPLOAD_DIR = Path("/root/propairty/uploads")

_PROMPT = (
    "You are a UK property maintenance triage assistant. "
    "Analyse the photo(s) of this reported maintenance issue.\n\n"
    "Respond with ONLY a valid JSON object (no markdown) with these fields:\n"
    "- diagnosis: one concise sentence describing what you see\n"
    "- severity: 'minor' | 'moderate' | 'urgent' | 'emergency'\n"
    "- self_fix_possible: true/false — can the tenant reasonably fix this themselves?\n"
    "- self_fix_tip: string or null — if self_fix_possible, one clear practical instruction\n"
    "- contractor_needed: true/false\n"
    "- contractor_type: string or null — e.g. 'plumber', 'electrician', 'roofer', 'general'\n"
    "- confidence: 'high' | 'medium' | 'low'\n\n"
    "Be concise and practical. UK property context."
)


def _parse_raw(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def _call_claude(content: list) -> dict | None:
    """Send content blocks to Claude Haiku vision and return parsed JSON."""
    from app.config import settings
    if not getattr(settings, "anthropic_api_key", None):
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": content}],
        )
        result = _parse_raw(msg.content[0].text)
        result["analysed_at"] = datetime.now(timezone.utc).isoformat()
        return result
    except Exception as exc:
        log.warning("Claude vision call failed: %s", exc)
        return None


def run_visual_triage(job_id: int, db) -> dict | None:
    """Analyse maintenance photos stored in DB via Claude vision; store result on the job."""
    from app.models.upload import UploadedFile
    from app.models.maintenance import MaintenanceRequest

    uploads = (
        db.query(UploadedFile)
        .filter(
            UploadedFile.entity_type == "maintenance",
            UploadedFile.entity_id == job_id,
            UploadedFile.mime_type.like("image/%"),
        )
        .limit(3)
        .all()
    )
    if not uploads:
        return None

    content = []
    for u in uploads:
        path = UPLOAD_DIR / u.filename
        if not path.exists():
            continue
        try:
            img_b64 = base64.standard_b64encode(path.read_bytes()).decode()
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": u.mime_type, "data": img_b64},
            })
        except Exception:
            continue

    if not content:
        return None

    content.append({"type": "text", "text": _PROMPT})
    result = _call_claude(content)
    if result:
        job = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == job_id).first()
        if job:
            job.ai_triage = json.dumps(result)
            db.commit()
    return result


def run_visual_triage_from_bytes(image_bytes: bytes, mime_type: str) -> dict | None:
    """Run visual triage on raw image bytes (for Telegram/WhatsApp/email attachments)."""
    if not image_bytes:
        return None
    # Normalise MIME — Telegram sometimes gives 'image/jpeg' variants
    if not mime_type or not mime_type.startswith("image/"):
        mime_type = "image/jpeg"
    try:
        img_b64 = base64.standard_b64encode(image_bytes).decode()
    except Exception:
        return None
    content = [
        {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": img_b64}},
        {"type": "text", "text": _PROMPT},
    ]
    return _call_claude(content)


def format_triage_reply(triage: dict) -> str:
    """Format a triage result as an HTML reply for Telegram."""
    severity_emoji = {"minor": "🟢", "moderate": "🟡", "urgent": "🟠", "emergency": "🔴"}.get(
        triage.get("severity", ""), "⚪"
    )
    lines = [
        "🔍 <b>AI Maintenance Diagnosis</b>",
        f"{severity_emoji} <b>Severity:</b> {triage.get('severity', 'unknown').capitalize()}",
        f"📋 <b>Diagnosis:</b> {triage.get('diagnosis', '—')}",
    ]
    if triage.get("self_fix_possible") and triage.get("self_fix_tip"):
        lines.append(f"\n💡 <b>You may be able to fix this yourself:</b>\n{triage['self_fix_tip']}")
    elif triage.get("contractor_needed"):
        ct = triage.get("contractor_type", "contractor")
        lines.append(f"\n🔧 <b>{ct.capitalize()} recommended</b> — your letting agent has been notified.")
    lines.append("\n<i>Your request has been logged and your agent will be in touch.</i>")
    return "\n".join(lines)
