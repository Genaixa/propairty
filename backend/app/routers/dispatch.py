"""
AI Maintenance Triage & Dispatch System.

Flow:
  1. Tenant or agent submits a maintenance request.
  2. AI classifies: trade + urgency + one-line summary.
  3. Urgent jobs → immediate dispatch (or agent alert in manual mode).
  4. Standard jobs → area queue grouped by (trade, postcode_district).
  5. Agent batches jobs per area or enables auto mode.
  6. Auto mode: dispatch when area threshold met OR max_wait_days exceeded.
"""
import os
import json
import smtplib
import ssl
from datetime import date, datetime, timedelta
from collections import defaultdict
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.maintenance import MaintenanceRequest
from app.models.unit import Unit
from app.models.property import Property
from app.models.contractor import Contractor
from app.models.tenant import Tenant
from app.models.lease import Lease
from app.models.organisation import Organisation
from app.models.dispatch import DispatchSettings, DispatchQueue, DispatchBatch
from app.config import settings
from app import notifications

router = APIRouter(prefix="/api/dispatch", tags=["dispatch"])

TRADE_LABELS = {
    "plumber": "Plumber",
    "electrician": "Electrician",
    "gas_engineer": "Gas Engineer",
    "carpenter": "Carpenter",
    "locksmith": "Locksmith",
    "roofer": "Roofer",
    "decorator": "Decorator",
    "handyman": "General Handyman",
    "pest_control": "Pest Control",
    "glazier": "Glazier",
    "cleaner": "Cleaner",
    "other": "Other",
}

URGENT_KEYWORDS = [
    "gas leak", "gas smell", "flood", "flooding", "burst pipe", "no power",
    "electrical fault", "sparks", "fire", "smoke", "broken lock", "no heating",
    "no hot water", "boiler broken", "boiler failure", "boiler not working",
    "water leak", "ceiling collapse", "structural", "carbon monoxide",
    "unsafe", "emergency", "urgent",
]


# ---------------------------------------------------------------------------
# AI classification
# ---------------------------------------------------------------------------

def _classify_issue(title: str, description: str) -> dict:
    """Use AI to classify trade type, urgency, and summarise the issue."""
    text = f"{title}. {description or ''}".strip()

    # Quick heuristic urgency check
    text_lower = text.lower()
    is_urgent_heuristic = any(kw in text_lower for kw in URGENT_KEYWORDS)

    prompt = f"""You are a property maintenance classifier for a UK letting agency.

Classify this maintenance issue and respond with ONLY valid JSON, no other text:

Issue: "{text}"

Return exactly this JSON structure:
{{
  "trade": "<one of: plumber, electrician, gas_engineer, carpenter, locksmith, roofer, decorator, handyman, pest_control, glazier, cleaner, other>",
  "urgency": "<urgent or standard>",
  "summary": "<one sentence plain English summary of the problem>",
  "confidence": "<high, medium, or low>"
}}

Rules:
- urgent = poses immediate risk to health/safety/security or causes significant damage if not fixed today
- standard = important but can wait 1-7 days
- gas_engineer for boilers, gas appliances, gas leaks
- plumber for water leaks, pipes, drains, taps (non-gas)"""

    try:
        import httpx
        from openai import OpenAI

        client, model = _get_ai_client()
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
        )
        text_out = resp.choices[0].message.content.strip()
        # Extract JSON
        start = text_out.find("{")
        end = text_out.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text_out[start:end])
            # Override urgency if heuristic strongly signals urgent
            if is_urgent_heuristic and result.get("urgency") != "urgent":
                result["urgency"] = "urgent"
                result["confidence"] = "high"
            return result
    except Exception as e:
        print(f"[dispatch] AI classification failed: {e}")

    # Fallback: heuristic only
    return _heuristic_classify(title, description, is_urgent_heuristic)


def _heuristic_classify(title: str, description: str, is_urgent: bool) -> dict:
    text = f"{title} {description or ''}".lower()
    trade = "handyman"
    if any(w in text for w in ["gas", "boiler", "heating", "combi", "central heating"]):
        trade = "gas_engineer"
    elif any(w in text for w in ["water", "leak", "pipe", "drain", "tap", "toilet", "shower", "bath", "flood"]):
        trade = "plumber"
    elif any(w in text for w in ["electric", "power", "socket", "light", "fuse", "circuit", "wiring"]):
        trade = "electrician"
    elif any(w in text for w in ["lock", "key", "door lock", "locked out"]):
        trade = "locksmith"
    elif any(w in text for w in ["roof", "gutter", "ceiling leak", "damp", "mould"]):
        trade = "roofer"
    elif any(w in text for w in ["window", "glass", "glazing"]):
        trade = "glazier"
    elif any(w in text for w in ["door", "window frame", "floor", "stairs", "cabinet", "wood"]):
        trade = "carpenter"
    elif any(w in text for w in ["pest", "mouse", "rat", "insect", "cockroach", "wasp", "bee"]):
        trade = "pest_control"

    return {
        "trade": trade,
        "urgency": "urgent" if is_urgent else "standard",
        "summary": f"{title}",
        "confidence": "medium",
    }


def _get_ai_client():
    try:
        import httpx
        from openai import OpenAI
        r = httpx.get("http://localhost:11434/api/tags", timeout=2)
        if r.status_code == 200:
            return OpenAI(base_url="http://localhost:11434/v1", api_key="ollama"), "llama3.2:3b"
    except Exception:
        pass
    mistral_key = os.environ.get("MISTRAL_API_KEY", "")
    if mistral_key:
        from openai import OpenAI
        return OpenAI(base_url="https://api.mistral.ai/v1", api_key=mistral_key), "mistral-small-latest"
    raise Exception("No AI provider available")


# ---------------------------------------------------------------------------
# Area extraction
# ---------------------------------------------------------------------------

def _postcode_district(postcode: str) -> str:
    """Extract postcode district from UK postcode: 'NE8 1AB' → 'NE8'."""
    if not postcode:
        return "Unknown"
    return postcode.strip().upper().split()[0]


# ---------------------------------------------------------------------------
# Dispatch settings helpers
# ---------------------------------------------------------------------------

def _get_settings(org_id: int, db: Session) -> DispatchSettings:
    s = db.query(DispatchSettings).filter(DispatchSettings.organisation_id == org_id).first()
    if not s:
        s = DispatchSettings(
            organisation_id=org_id,
            auto_mode=False,
            urgent_auto_dispatch=True,
            area_threshold=3,
            max_wait_days=7,
        )
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# Core: add job to dispatch queue and trigger if needed
# ---------------------------------------------------------------------------

def enqueue_job(job: MaintenanceRequest, db: Session):
    """Called after a maintenance request is created. Classify and queue."""
    # Skip if already in queue
    existing = db.query(DispatchQueue).filter(
        DispatchQueue.maintenance_request_id == job.id
    ).first()
    if existing:
        return existing

    unit = db.query(Unit).join(Property).filter(Unit.id == job.unit_id).first()
    if not unit:
        return None
    prop = unit.property

    classification = _classify_issue(job.title, job.description or "")
    trade = classification.get("trade", "handyman")
    urgency = classification.get("urgency", "standard")
    summary = classification.get("summary", job.title)
    confidence = classification.get("confidence", "medium")
    area = _postcode_district(prop.postcode)

    queue_item = DispatchQueue(
        organisation_id=prop.organisation_id,
        maintenance_request_id=job.id,
        trade=trade,
        area=area,
        city=prop.city,
        urgency=urgency,
        status="queued",
        ai_summary=summary,
        ai_confidence=confidence,
    )
    db.add(queue_item)
    db.commit()
    db.refresh(queue_item)

    org_settings = _get_settings(prop.organisation_id, db)

    if urgency == "urgent":
        if org_settings.urgent_auto_dispatch:
            # Try to auto-dispatch immediately
            contractor = _find_contractor(prop.organisation_id, trade, db)
            if contractor:
                _dispatch_batch([queue_item], contractor, db, dispatched_by="auto-urgent")
                return queue_item
        # Notify agent urgently
        notifications.send(
            f"🚨 <b>URGENT Maintenance — {TRADE_LABELS.get(trade, trade)}</b>\n\n"
            f"<b>{job.title}</b>\n"
            f"Property: {prop.name} · {unit.name}\n"
            f"AI Summary: {summary}\n\n"
            f"⚡ Auto-dispatched to contractor" if org_settings.urgent_auto_dispatch else
            f"🚨 <b>URGENT Maintenance — {TRADE_LABELS.get(trade, trade)}</b>\n\n"
            f"<b>{job.title}</b>\n"
            f"Property: {prop.name} · {unit.name}\n"
            f"AI Summary: {summary}\n\n"
            f"⚠️ Action required — no contractor found or auto-dispatch off"
        )
    else:
        # Check if auto threshold is met for this area+trade
        if org_settings.auto_mode:
            _check_and_auto_dispatch(prop.organisation_id, trade, area, db, org_settings)
        else:
            # Just notify agent of new queued job
            notifications.send(
                f"📋 <b>Maintenance Queued — {TRADE_LABELS.get(trade, trade)}</b>\n\n"
                f"{job.title}\n"
                f"Property: {prop.name} · {unit.name}\n"
                f"Area: {area} · Priority: Standard\n"
                f"AI: {summary}\n\n"
                f"Visit /dispatch to manage the queue."
            )

    return queue_item


def _check_and_auto_dispatch(org_id: int, trade: str, area: str, db: Session, org_settings: DispatchSettings):
    """Check if threshold is met for area+trade and auto-dispatch if so."""
    queued = db.query(DispatchQueue).filter(
        DispatchQueue.organisation_id == org_id,
        DispatchQueue.trade == trade,
        DispatchQueue.area == area,
        DispatchQueue.status == "queued",
        DispatchQueue.urgency == "standard",
    ).all()

    threshold_met = len(queued) >= org_settings.area_threshold

    # Also check if oldest job has exceeded max_wait_days
    max_wait_exceeded = False
    if queued:
        oldest = min(q.created_at for q in queued)
        max_wait_exceeded = (datetime.utcnow() - oldest.replace(tzinfo=None)).days >= org_settings.max_wait_days

    if threshold_met or max_wait_exceeded:
        contractor = _find_contractor(org_id, trade, db)
        if contractor:
            reason = f"threshold ({len(queued)} jobs)" if threshold_met else f"max wait exceeded ({org_settings.max_wait_days}d)"
            _dispatch_batch(queued, contractor, db, dispatched_by=f"auto ({reason})")


def _find_contractor(org_id: int, trade: str, db: Session) -> Optional[Contractor]:
    """Find the best active contractor for this trade in the org."""
    # Exact trade match first
    c = db.query(Contractor).filter(
        Contractor.organisation_id == org_id,
        Contractor.trade == trade,
        Contractor.is_active == True,
        Contractor.email.isnot(None),
    ).first()
    return c


def _dispatch_batch(items: list[DispatchQueue], contractor: Contractor, db: Session, dispatched_by: str = "agent"):
    """Email contractor all jobs in the batch and update DB."""
    if not items:
        return

    org_id = items[0].organisation_id
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    trade = items[0].trade
    area = items[0].area

    # Create batch record
    batch = DispatchBatch(
        organisation_id=org_id,
        contractor_id=contractor.id,
        trade=trade,
        area=area,
        job_count=len(items),
        dispatched_by=dispatched_by,
    )
    db.add(batch)
    db.flush()

    # Update queue items
    now = datetime.utcnow()
    for item in items:
        item.status = "dispatched"
        item.batch_id = batch.id
        item.dispatched_at = now
        # Update maintenance request status
        job = item.job
        if job and job.status == "open":
            job.status = "in_progress"
            job.contractor_id = contractor.id
            job.assigned_to = contractor.full_name

    db.commit()

    # Send email to contractor
    _email_contractor_batch(contractor, items, org, area, org_id, db)

    # Telegram notification
    notifications.send(
        f"✅ <b>Batch Dispatched — {TRADE_LABELS.get(trade, trade)}</b>\n\n"
        f"Contractor: {contractor.full_name}"
        + (f" ({contractor.company_name})" if contractor.company_name else "") +
        f"\nArea: {area} · {len(items)} job{'s' if len(items) > 1 else ''}\n"
        f"Dispatched by: {dispatched_by}\n\n"
        + "\n".join(f"• {item.job.title if item.job else '?'}" for item in items[:5])
        + (f"\n+ {len(items) - 5} more" if len(items) > 5 else "")
    )


def _email_contractor_batch(contractor: Contractor, items: list[DispatchQueue], org, area: str, org_id: int, db: Session):
    """Send batch job email to contractor."""
    if not contractor.email or not settings.smtp_host:
        print(f"[dispatch] Cannot email contractor {contractor.full_name} — no email or SMTP not configured")
        return

    trade_label = TRADE_LABELS.get(items[0].trade, items[0].trade)
    org_name = org.name if org else "Your Letting Agent"

    jobs_html = ""
    for i, item in enumerate(items, 1):
        job = item.job
        if not job:
            continue
        unit = job.unit
        prop = unit.property if unit else None

        # Find active tenant for this unit
        lease = db.query(Lease).filter(
            Lease.unit_id == unit.id if unit else 0,
            Lease.status == "active"
        ).first() if unit else None
        tenant = lease.tenant if lease else None

        jobs_html += f"""
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <strong style="color:#111827;">Job {i}: {job.title}</strong>
            <span style="background:#{'fee2e2' if item.urgency == 'urgent' else 'dbeafe'}; color:#{'dc2626' if item.urgency == 'urgent' else '1d4ed8'}; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:700;">{item.urgency.upper()}</span>
          </div>
          <p style="color:#6b7280; font-size:13px; margin:0 0 8px;">{item.ai_summary or job.description or ''}</p>
          <table style="font-size:12px; color:#374151; width:100%;">
            <tr><td style="padding:3px 0; width:100px;"><strong>Property:</strong></td><td>{prop.name if prop else '?'} · {unit.name if unit else '?'}</td></tr>
            <tr><td style="padding:3px 0;"><strong>Address:</strong></td><td>{prop.address_line1 + ', ' + prop.city + ', ' + prop.postcode if prop else '?'}</td></tr>
            {'<tr><td style="padding:3px 0;"><strong>Tenant:</strong></td><td>' + tenant.full_name + '</td></tr>' if tenant else ''}
            {'<tr><td style="padding:3px 0;"><strong>Phone:</strong></td><td>' + (tenant.phone or 'Not provided') + '</td></tr>' if tenant else ''}
            {'<tr><td style="padding:3px 0;"><strong>Email:</strong></td><td>' + (tenant.email or 'Not provided') + '</td></tr>' if tenant else ''}
          </table>
        </div>"""

    subject = f"New {trade_label} jobs — {len(items)} job{'s' if len(items) > 1 else ''} in {area} from {org_name}"
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f9fafb; margin:0; padding:0;">
<div style="max-width:600px; margin:40px auto; background:white; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
  <div style="background:#4f46e5; padding:24px 32px;">
    <h1 style="color:white; margin:0; font-size:20px; font-weight:700;">PropAIrty</h1>
    <p style="color:#c7d2fe; margin:4px 0 0; font-size:13px;">{org_name}</p>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#111827; font-size:18px; margin:0 0 4px;">{trade_label} Jobs — {area}</h2>
    <p style="color:#6b7280; font-size:13px; margin:0 0 24px;">You have been assigned {len(items)} maintenance job{'s' if len(items) > 1 else ''} in the {area} area. Please contact each tenant to arrange a convenient time.</p>
    {jobs_html}
    <p style="color:#6b7280; font-size:13px; margin-top:24px;">Please confirm receipt of this job sheet by replying to this email. Contact {org_name} with any queries.</p>
  </div>
  <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px;">
    <p style="color:#9ca3af; font-size:12px; margin:0;">Sent by PropAIrty on behalf of {org_name}</p>
  </div>
</div>
</body></html>"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = contractor.email
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, contractor.email, msg.as_string())
        print(f"[dispatch] Sent {len(items)} jobs to {contractor.email}")
    except Exception as e:
        print(f"[dispatch] Email to contractor failed: {e}")


# ---------------------------------------------------------------------------
# Scheduled auto-dispatch check (called from daily scheduler)
# ---------------------------------------------------------------------------

def run_auto_dispatch(db: Session):
    """Check all queued jobs for max_wait_days threshold. Called daily by scheduler."""
    from app.models.organisation import Organisation
    orgs = db.query(Organisation).all()
    for org in orgs:
        s = _get_settings(org.id, db)
        if not s.auto_mode:
            continue
        # Group all queued standard jobs by trade+area
        queued = db.query(DispatchQueue).filter(
            DispatchQueue.organisation_id == org.id,
            DispatchQueue.status == "queued",
            DispatchQueue.urgency == "standard",
        ).all()
        groups = defaultdict(list)
        for q in queued:
            groups[(q.trade, q.area)].append(q)
        for (trade, area), items in groups.items():
            oldest = min(i.created_at for i in items)
            wait_exceeded = (datetime.utcnow() - oldest.replace(tzinfo=None)).days >= s.max_wait_days
            threshold_met = len(items) >= s.area_threshold
            if wait_exceeded or threshold_met:
                contractor = _find_contractor(org.id, trade, db)
                if contractor:
                    reason = "max wait" if wait_exceeded else f"threshold ({len(items)})"
                    _dispatch_batch(items, contractor, db, dispatched_by=f"auto ({reason})")
                else:
                    notifications.send(
                        f"⚠️ <b>Auto-Dispatch Blocked</b>\n\n"
                        f"No active {TRADE_LABELS.get(trade, trade)} contractor found for {len(items)} jobs in {area}.\n"
                        f"Please add a contractor or dispatch manually."
                    )


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

class SettingsUpdate(BaseModel):
    auto_mode: Optional[bool] = None
    urgent_auto_dispatch: Optional[bool] = None
    area_threshold: Optional[int] = None
    max_wait_days: Optional[int] = None


class BatchDispatchRequest(BaseModel):
    queue_ids: list[int]
    contractor_id: int
    note: Optional[str] = None


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _get_settings(current_user.organisation_id, db)
    return {
        "auto_mode": s.auto_mode,
        "urgent_auto_dispatch": s.urgent_auto_dispatch,
        "area_threshold": s.area_threshold,
        "max_wait_days": s.max_wait_days,
    }


@router.put("/settings")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _get_settings(current_user.organisation_id, db)
    if data.auto_mode is not None:
        s.auto_mode = data.auto_mode
    if data.urgent_auto_dispatch is not None:
        s.urgent_auto_dispatch = data.urgent_auto_dispatch
    if data.area_threshold is not None:
        s.area_threshold = max(1, data.area_threshold)
    if data.max_wait_days is not None:
        s.max_wait_days = max(1, data.max_wait_days)
    db.commit()
    db.refresh(s)

    mode_str = "AUTO" if s.auto_mode else "MANUAL"
    notifications.send(
        f"⚙️ <b>Dispatch Settings Updated</b>\n\n"
        f"Mode: <b>{mode_str}</b>\n"
        f"Urgent auto-dispatch: {'ON' if s.urgent_auto_dispatch else 'OFF'}\n"
        f"Area threshold: {s.area_threshold} jobs\n"
        f"Max wait: {s.max_wait_days} days"
    )
    return {"ok": True, "auto_mode": s.auto_mode}


@router.get("/queue")
def get_queue(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return queued jobs grouped by area+trade."""
    org_id = current_user.organisation_id
    s = _get_settings(org_id, db)

    queued = db.query(DispatchQueue).filter(
        DispatchQueue.organisation_id == org_id,
        DispatchQueue.status == "queued",
    ).order_by(DispatchQueue.created_at).all()

    # Build groups
    urgent_items = []
    groups = defaultdict(list)
    for q in queued:
        if q.urgency == "urgent":
            urgent_items.append(_queue_item_out(q, db))
        else:
            groups[(q.trade, q.area)].append(q)

    area_groups = []
    for (trade, area), items in sorted(groups.items(), key=lambda x: -len(x[1])):
        oldest = min(i.created_at for i in items)
        days_waiting = (datetime.utcnow() - oldest.replace(tzinfo=None)).days
        contractor = _find_contractor(org_id, trade, db)
        area_groups.append({
            "trade": trade,
            "trade_label": TRADE_LABELS.get(trade, trade),
            "area": area,
            "city": items[0].city,
            "count": len(items),
            "days_waiting": days_waiting,
            "threshold": s.area_threshold,
            "threshold_met": len(items) >= s.area_threshold,
            "max_wait_exceeded": days_waiting >= s.max_wait_days,
            "suggested_contractor": {"id": contractor.id, "name": contractor.full_name, "company": contractor.company_name} if contractor else None,
            "jobs": [_queue_item_out(i, db) for i in items],
        })

    return {
        "settings": {
            "auto_mode": s.auto_mode,
            "urgent_auto_dispatch": s.urgent_auto_dispatch,
            "area_threshold": s.area_threshold,
            "max_wait_days": s.max_wait_days,
        },
        "urgent": urgent_items,
        "groups": area_groups,
        "total_queued": len(queued),
    }


@router.post("/batch")
def dispatch_batch(data: BatchDispatchRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually dispatch a batch of jobs to a contractor."""
    items = db.query(DispatchQueue).filter(
        DispatchQueue.id.in_(data.queue_ids),
        DispatchQueue.organisation_id == current_user.organisation_id,
        DispatchQueue.status == "queued",
    ).all()
    if not items:
        raise HTTPException(status_code=404, detail="No queued items found")

    contractor = db.query(Contractor).filter(
        Contractor.id == data.contractor_id,
        Contractor.organisation_id == current_user.organisation_id,
        Contractor.is_active == True,
    ).first()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    # Allow overriding note on batch
    _dispatch_batch(items, contractor, db, dispatched_by=f"agent:{current_user.id}")
    if data.note:
        batch = items[0].batch
        if batch:
            batch.note = data.note
            db.commit()

    return {"ok": True, "dispatched": len(items), "contractor": contractor.full_name}


@router.post("/classify/{maintenance_id}")
def classify_job(maintenance_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Classify and enqueue an existing maintenance request."""
    job = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == maintenance_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    item = enqueue_job(job, db)
    if not item:
        raise HTTPException(status_code=400, detail="Could not classify job")
    return _queue_item_out(item, db)


@router.delete("/queue/{queue_id}")
def remove_from_queue(queue_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Remove a job from the queue (agent decided not to dispatch)."""
    item = db.query(DispatchQueue).filter(
        DispatchQueue.id == queue_id,
        DispatchQueue.organisation_id == current_user.organisation_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.status = "cancelled"
    db.commit()
    return {"ok": True}


@router.get("/history")
def dispatch_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batches = db.query(DispatchBatch).filter(
        DispatchBatch.organisation_id == current_user.organisation_id,
    ).order_by(DispatchBatch.created_at.desc()).limit(50).all()

    return [
        {
            "id": b.id,
            "trade": b.trade,
            "trade_label": TRADE_LABELS.get(b.trade, b.trade),
            "area": b.area,
            "contractor": b.contractor.full_name if b.contractor else "Unknown",
            "contractor_company": b.contractor.company_name if b.contractor else None,
            "job_count": b.job_count,
            "dispatched_by": b.dispatched_by,
            "note": b.note,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "jobs": [
                {
                    "title": item.job.title if item.job else "?",
                    "ai_summary": item.ai_summary,
                    "property": item.job.unit.property.name if item.job and item.job.unit else None,
                    "unit": item.job.unit.name if item.job and item.job.unit else None,
                }
                for item in b.items
            ],
        }
        for b in batches
    ]


def _queue_item_out(q: DispatchQueue, db: Session) -> dict:
    job = q.job
    unit = job.unit if job else None
    prop = unit.property if unit else None
    lease = db.query(Lease).filter(
        Lease.unit_id == unit.id if unit else 0,
        Lease.status == "active"
    ).first() if unit else None
    tenant = lease.tenant if lease else None
    days_waiting = (datetime.utcnow() - q.created_at.replace(tzinfo=None)).days if q.created_at else 0
    return {
        "id": q.id,
        "maintenance_id": q.maintenance_request_id,
        "trade": q.trade,
        "trade_label": TRADE_LABELS.get(q.trade, q.trade),
        "area": q.area,
        "city": q.city,
        "urgency": q.urgency,
        "status": q.status,
        "ai_summary": q.ai_summary,
        "ai_confidence": q.ai_confidence,
        "days_waiting": days_waiting,
        "title": job.title if job else "?",
        "description": job.description if job else None,
        "priority": job.priority if job else None,
        "property": prop.name if prop else None,
        "address": f"{prop.address_line1}, {prop.city}" if prop else None,
        "unit": unit.name if unit else None,
        "tenant_name": tenant.full_name if tenant else None,
        "tenant_phone": tenant.phone if tenant else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }
