"""
AI Phone Agent — 24/7 tenant maintenance intake via Twilio Voice.

Flow:
  1. Tenant calls the Twilio number
  2. Twilio POSTs to /api/phone/incoming → we return TwiML greeting + gather speech
  3. Tenant speaks their issue
  4. Twilio POSTs transcript to /api/phone/gather → Claude interprets → MaintenanceRequest created
  5. TwiML confirmation read back to tenant with reference number

Setup:
  - Buy a Twilio number at twilio.com
  - Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env.production
  - In Twilio console → Phone Numbers → your number:
      Voice webhook (HTTP POST): https://propairty.co.uk/api/phone/incoming
"""
import os
import re
import json
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.maintenance import MaintenanceRequest
from app.models.tenant import Tenant
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
from app.config import settings
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/phone", tags=["phone"])

TWIML_CONTENT_TYPE = "text/xml"


def _twiml(xml_body: str) -> PlainTextResponse:
    return PlainTextResponse(
        f'<?xml version="1.0" encoding="UTF-8"?><Response>{xml_body}</Response>',
        media_type=TWIML_CONTENT_TYPE,
    )


def _claude_interpret(transcript: str, org_name: str) -> dict:
    """Use Claude to interpret a tenant's spoken maintenance report."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
        prompt = f"""A tenant has called {org_name} to report a maintenance issue. Here is what they said:

"{transcript}"

Extract the following and return as JSON:
{{
  "title": "short title for the maintenance request (max 60 chars)",
  "description": "full description of the issue as reported",
  "priority": "low|medium|high|urgent",
  "category": "plumbing|electrical|heating|structural|appliance|pest|other",
  "is_emergency": true/false
}}

Priority guide: urgent=no heating/hot water/gas leak/flooding/security, high=broken appliance/leak, medium=general repairs, low=cosmetic."""

        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        return json.loads(match.group()) if match else {}
    except Exception:
        return {
            "title": "Maintenance request via phone",
            "description": transcript,
            "priority": "medium",
            "category": "other",
            "is_emergency": False,
        }


def _lookup_caller(from_number: str, db: Session):
    """Find a tenant by their phone number."""
    # Normalise number for comparison (strip spaces/dashes)
    clean = re.sub(r'[\s\-\(\)]', '', from_number)
    tenants = db.query(Tenant).all()
    for t in tenants:
        if t.phone:
            t_clean = re.sub(r'[\s\-\(\)]', '', t.phone)
            if t_clean == clean or t_clean.endswith(clean[-9:]):
                return t
    return None


@router.post("/incoming")
async def incoming_call(request: Request, db: Session = Depends(get_db)):
    """
    Twilio webhook — called when a tenant rings the PropAIrty number.
    Returns TwiML to greet and gather speech.
    """
    form = await request.form()
    from_number = form.get("From", "")
    to_number = form.get("To", "")

    # Find org from the Twilio number (stored in settings or first org if single-tenant)
    org = db.query(Organisation).first()
    org_name = org.name if org else "your letting agent"

    # Try to identify caller
    tenant = _lookup_caller(from_number, db)
    greeting = f"Hello {tenant.full_name.split()[0]}," if tenant else "Hello,"

    gather_url = "/api/phone/gather"

    xml = f"""
    <Say voice="Polly.Amy" language="en-GB">{greeting} you've reached {org_name}. I'm here to take your maintenance request 24 hours a day. Please describe your issue clearly after the tone, then press any key or stop speaking when you're done.</Say>
    <Gather input="speech" action="{gather_url}" method="POST" speechTimeout="3" timeout="10" language="en-GB">
      <Say voice="Polly.Amy" language="en-GB">Please go ahead.</Say>
    </Gather>
    <Say voice="Polly.Amy" language="en-GB">Sorry, I didn't catch that. Please call back to report your issue, or contact the office directly.</Say>
    """
    return _twiml(xml)


@router.post("/gather")
async def gather_speech(request: Request, db: Session = Depends(get_db)):
    """
    Twilio webhook — called after tenant speaks.
    Interprets the issue with Claude and creates a MaintenanceRequest.
    """
    form = await request.form()
    transcript = form.get("SpeechResult", "").strip()
    from_number = form.get("From", "")
    confidence = float(form.get("Confidence", "0"))

    if not transcript or confidence < 0.3:
        return _twiml(
            '<Say voice="Polly.Amy" language="en-GB">Sorry, I couldn\'t understand that clearly. '
            'Please call back or contact the office directly. Goodbye.</Say>'
        )

    # Identify caller and their unit/property
    tenant = _lookup_caller(from_number, db)
    org = db.query(Organisation).first()
    org_name = org.name if org else "your letting agent"

    # Find tenant's active unit
    unit = None
    property_id = None
    if tenant:
        lease = next(
            (l for l in (tenant.leases or []) if l.status == "active"),
            None,
        )
        if lease:
            unit = lease.unit
            if unit:
                property_id = unit.property_id

    # If no unit found, use first property's first unit as fallback
    if not unit:
        prop = db.query(Property).first()
        if prop and prop.units:
            unit = prop.units[0]
            property_id = prop.id

    if not unit:
        return _twiml(
            '<Say voice="Polly.Amy" language="en-GB">Thank you for calling. '
            'I\'ve noted your message but couldn\'t match your number to a tenancy. '
            'Someone will call you back. Goodbye.</Say>'
        )

    # Interpret with Claude
    interpreted = _claude_interpret(transcript, org_name)

    # Create maintenance request
    req = MaintenanceRequest(
        organisation_id=org.id if org else None,
        property_id=property_id,
        unit_id=unit.id,
        title=interpreted.get("title", "Phone maintenance report"),
        description=f"[PHONE INTAKE - {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')}]\n\n"
                    f"Caller: {tenant.full_name if tenant else from_number}\n"
                    f"Transcript: {transcript}\n\n"
                    f"AI summary: {interpreted.get('description', transcript)}",
        priority=interpreted.get("priority", "medium"),
        reported_by=tenant.full_name if tenant else f"Phone: {from_number}",
        reported_by_tenant_id=tenant.id if tenant else None,
        status="open",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    ref = f"MR-{req.id:05d}"
    priority_msg = " This has been flagged as urgent." if interpreted.get("is_emergency") else ""

    return _twiml(
        f'<Say voice="Polly.Amy" language="en-GB">'
        f'Thank you. I\'ve logged your maintenance request with reference number {" ".join(ref)}.'
        f'{priority_msg} '
        f'Someone from {org_name} will be in touch shortly. Goodbye.</Say>'
    )


@router.get("/setup")
def phone_setup(current_user: User = Depends(get_current_user)):
    """Return setup instructions and current config status."""
    configured = bool(
        os.environ.get("TWILIO_ACCOUNT_SID") and
        os.environ.get("TWILIO_AUTH_TOKEN")
    )
    return {
        "configured": configured,
        "webhook_url": "https://propairty.co.uk/api/phone/incoming",
        "gather_url": "https://propairty.co.uk/api/phone/gather",
        "instructions": [
            "Sign up at twilio.com and buy a UK phone number",
            "Add to .env.production: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN",
            "In Twilio console → Phone Numbers → your number → Voice webhook (HTTP POST):",
            "  https://propairty.co.uk/api/phone/incoming",
            "Tenants call the number 24/7 — AI answers, logs the job, gives a reference number",
        ],
    }
