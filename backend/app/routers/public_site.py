"""
Public-facing agency website endpoints — no authentication required.
Served at /api/public/{slug}/...
"""
import json
import time
import io
import requests as _requests
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy.orm import Session
from app.config import settings

from app.database import get_db
from app.models.organisation import Organisation
from app.models.property import Property
from app.models.unit import Unit
from app.models.applicant import Applicant
from app.models.upload import UploadedFile
from app.models.saved_search import SavedSearch
from app.models.public_content import PublicReview, BlogPost, ValuationRequest
from app.models.public_user import PublicUser, SavedProperty
from app.auth import hash_password, verify_password, create_access_token
from app import emails
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/api/public", tags=["public"])

# In-memory Pexels cache: query → (url, expires_at)
_pexels_cache: dict[str, tuple[str, float]] = {}
PEXELS_KEY = settings.pexels_api_key

# ── Shared chat models (used by both agency chat and Wendy) ───────────────────
class PublicChatMessage(BaseModel):
    role: str
    content: str

class PublicChatRequest(BaseModel):
    messages: List[PublicChatMessage]


@router.get("/portal-info")
def portal_info(db: Session = Depends(get_db)):
    """Returns basic agency branding for the portal picker page — no auth required."""
    org = db.query(Organisation).first()
    if not org:
        return {"name": None, "website_url": None, "logo_url": None}
    return {"name": org.name, "website_url": org.website_url, "logo_url": org.logo_url}


@router.get("/pexels-photo")
def pexels_photo(query: str = "modern apartment interior uk"):
    now = time.time()
    if query in _pexels_cache:
        url, exp = _pexels_cache[query]
        if now < exp:
            return {"url": url}
    if not PEXELS_KEY:
        return {"url": None}
    try:
        r = _requests.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": PEXELS_KEY},
            params={"query": query, "per_page": 15, "orientation": "landscape"},
            timeout=5,
        )
        photos = r.json().get("photos", [])
        if not photos:
            return {"url": None}
        idx = hash(query) % len(photos)
        url = photos[idx]["src"]["large"]
        _pexels_cache[query] = (url, now + 86400)
        return {"url": url}
    except Exception:
        return {"url": None}


# ── Fixed routes — must come before /{slug} wildcard ─────────────────────────

@router.get("/resolve")
def resolve_custom_domain(request: Request, db: Session = Depends(get_db)):
    """Resolve a custom domain to an agency slug. Called by the frontend when served on a custom domain."""
    host = request.headers.get("host", "").split(":")[0].lower().strip()
    if not host or host in ("propairty.co.uk", "www.propairty.co.uk", "app.propairty.co.uk", "localhost"):
        raise HTTPException(status_code=404, detail="Not a custom domain")
    # Strip port if present
    org = db.query(Organisation).filter(Organisation.custom_domain == host).first()
    if not org:
        raise HTTPException(status_code=404, detail="Domain not configured")
    return {"slug": org.slug, "name": org.name}


@router.get("/faq")
async def get_faq():
    """Return the auto-generated PropAIrty FAQ (refreshed daily at noon)."""
    from app import wendy as _wendy
    return {"faq": _wendy.get_faq()}


@router.post("/wendy")
async def wendy_chat(req: PublicChatRequest, request: Request):
    """Wendy — main PropAIrty marketing site AI chat. No auth, no DB. Rate-limited per IP."""
    from app import wendy as _wendy

    ip = request.client.host if request.client else "unknown"
    now = time.time()
    count, window_start = _chat_rate.get(ip, (0, now))
    if now - window_start > _CHAT_WINDOW:
        count, window_start = 0, now
    if count >= _CHAT_LIMIT:
        raise HTTPException(status_code=429, detail="Too many messages — please wait a few minutes.")
    _chat_rate[ip] = (count + 1, window_start)

    system_prompt = _wendy.get()
    messages_in = [{"role": m.role, "content": m.content} for m in req.messages]

    if settings.anthropic_api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system_prompt,
                messages=messages_in,
            )
            reply = resp.content[0].text.strip() if resp.content else ""
            return {"reply": reply}
        except Exception as e:
            print(f"[wendy] Anthropic error: {e}")

    from app.ai_utils import openrouter_chat
    reply = openrouter_chat([{"role": "system", "content": system_prompt}] + messages_in)
    if reply:
        return {"reply": reply}

    if settings.mistral_api_key:
        try:
            from openai import OpenAI as _OAI
            oai = _OAI(base_url="https://api.mistral.ai/v1", api_key=settings.mistral_api_key)
            msgs = [{"role": "system", "content": system_prompt}] + messages_in
            resp = oai.chat.completions.create(model="mistral-small-latest", messages=msgs, timeout=30)
            reply = resp.choices[0].message.content or ""
            return {"reply": reply}
        except Exception as e:
            print(f"[wendy] Mistral error: {e}")

    raise HTTPException(status_code=503, detail="AI chat is temporarily unavailable.")


def _get_org(slug: str, db: Session) -> Organisation:
    org = db.query(Organisation).filter(Organisation.slug == slug).first()
    if not org:
        raise HTTPException(status_code=404, detail="Agency not found")
    return org


def _unit_dict(u: Unit) -> dict:
    monthly = float(u.monthly_rent)
    weekly  = monthly * 12 / 52
    deposit_weeks = u.deposit_weeks or 5
    deposit_amt   = round(weekly * deposit_weeks)
    try:
        amenities = json.loads(u.amenities or "[]")
    except Exception:
        amenities = []
    try:
        rooms = json.loads(u.rooms or "[]")
    except Exception:
        rooms = []
    return {
        "id": u.id,
        "name": u.name,
        "bedrooms": u.bedrooms,
        "bathrooms": u.bathrooms,
        "reception_rooms": u.reception_rooms or 0,
        "monthly_rent": monthly,
        "weekly_rent": round(weekly, 2),
        "previous_rent": float(u.previous_rent) if u.previous_rent else None,
        "date_listed": u.date_listed.isoformat() if u.date_listed else None,
        "available_from": u.available_from.isoformat() if u.available_from else None,
        "furnished": u.furnished,
        "deposit_weeks": deposit_weeks,
        "deposit_amount": deposit_amt,
        "occupancy_type": u.occupancy_type,
        "amenities": amenities,
        "rooms": rooms,
    }


def _prop_dict(p: Property, photo_urls: list, org_id: int, floorplan_url: str = None, brochure_url: str = None) -> dict:
    vacant = [u for u in p.units if u.status == "vacant"]
    features = [f.strip() for f in (p.features or "").splitlines() if f.strip()]
    return {
        "id": p.id,
        "reference_number": p.reference_number or f"PROP-{p.id:04d}",
        "name": p.name,
        "address_line1": p.address_line1,
        "address_line2": p.address_line2,
        "city": p.city,
        "postcode": p.postcode,
        "property_type": p.property_type,
        "description": p.description,
        "epc_rating": p.epc_rating,
        "epc_potential": p.epc_potential,
        "tenure": p.tenure,
        "council_tax_band": p.council_tax_band,
        "bills_included": bool(p.bills_included),
        "features": features,
        "virtual_tour_url": p.virtual_tour_url,
        "photo_url": photo_urls[0] if photo_urls else None,
        "photos": photo_urls,
        "floorplan_url": floorplan_url,
        "brochure_url": brochure_url,
        "units": [_unit_dict(u) for u in vacant],
    }


@router.get("/{slug}")
def public_agency(slug: str, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    try:
        opening_hours = json.loads(org.opening_hours_json or "[]")
    except Exception:
        opening_hours = []
    return {
        "name": org.name,
        "slug": org.slug,
        "email": org.email,
        "phone": org.phone,
        "logo_url": org.logo_url,
        "brand_color": org.brand_color,
        "tagline": org.tagline,
        "address_text": org.address_text,
        "website_url": org.website_url,
        "opening_hours": opening_hours,
        "social_facebook": org.social_facebook,
        "social_instagram": org.social_instagram,
        "social_twitter": org.social_twitter,
        "founded_year": org.founded_year,
    }


def _fetch_photos_and_floorplan(db, prop, org_id):
    """Return (photo_urls, floorplan_url, brochure_url) for a property."""
    files = db.query(UploadedFile).filter(
        UploadedFile.entity_type == "property",
        UploadedFile.entity_id == prop.id,
        UploadedFile.organisation_id == org_id,
    ).order_by(UploadedFile.id.asc()).all()
    photo_urls = [f"/uploads/{f.filename}" for f in files if f.category == "photo"]
    floorplan = next((f for f in files if f.category == "floorplan"), None)
    brochure = next((f for f in files if f.category == "brochure"), None)
    floorplan_url = f"/uploads/{floorplan.filename}" if floorplan else None
    brochure_url = f"/uploads/{brochure.filename}" if brochure else None
    return photo_urls, floorplan_url, brochure_url


@router.get("/{slug}/properties")
def public_properties(slug: str, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    props = db.query(Property).filter(Property.organisation_id == org.id).all()
    result = []
    for p in props:
        vacant = [u for u in p.units if u.status == "vacant"]
        if not vacant:
            continue
        photo_urls, floorplan_url, brochure_url = _fetch_photos_and_floorplan(db, p, org.id)
        d = _prop_dict(p, photo_urls, org.id, floorplan_url, brochure_url)
        d["featured"] = bool(p.featured)
        result.append(d)
    # Featured properties always appear first
    result.sort(key=lambda x: (0 if x.get("featured") else 1))
    return result


@router.get("/{slug}/property/{property_id}")
def public_property_detail(slug: str, property_id: int, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organisation_id == org.id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    photo_urls, floorplan_url, brochure_url = _fetch_photos_and_floorplan(db, prop, org.id)
    return _prop_dict(prop, photo_urls, org.id, floorplan_url, brochure_url)


class EnquiryRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str = ""
    message: str = ""
    property_id: int | None = None
    unit_id: int | None = None


def _send_enquiry_email(org, applicant_name, applicant_email, applicant_phone, message, property_name, unit_name):
    if not settings.smtp_host or not settings.smtp_user or not org.email:
        return
    try:
        import smtplib, ssl
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        phone_line = f"<p><strong>Phone:</strong> {applicant_phone}</p>" if applicant_phone else ""
        msg_line = f"<p><strong>Message:</strong> {message}</p>" if message else ""
        prop_line = f"<p><strong>Property:</strong> {property_name}" + (f" — {unit_name}" if unit_name else "") + "</p>" if property_name else ""
        html = f"""<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto">
          <div style="background:{org.brand_color or '#4f46e5'};padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">New Viewing Request</h1>
            <p style="color:#e0e7ff;margin:4px 0 0;font-size:14px">{org.name}</p>
          </div>
          <div style="padding:28px 32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
            <p style="color:#374151;font-size:15px">A prospective tenant submitted a viewing request via your PropAIrty website.</p>
            <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0">
              <p style="margin:0 0 8px"><strong>Name:</strong> {applicant_name}</p>
              <p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:{applicant_email}">{applicant_email}</a></p>
              {phone_line}{prop_line}{msg_line}
            </div>
            <a href="https://propairty.co.uk/applicants"
               style="display:inline-block;background:{org.brand_color or '#4f46e5'};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              View in PropAIrty →
            </a>
          </div>
        </div>"""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"New viewing request — {property_name or 'your properties'}"
        msg["From"] = settings.smtp_from
        msg["To"] = org.email
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, org.email, msg.as_string())
    except Exception as e:
        print(f"[public] Enquiry email failed: {e}")


def _send_confirmation_email(org, applicant_name: str, applicant_email: str, property_name: str, mode: str):
    """Send a confirmation email to the applicant (not the agent)."""
    if not settings.smtp_host or not settings.smtp_user or not applicant_email:
        return
    try:
        import smtplib, ssl
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        brand = org.brand_color or '#4f46e5'
        if mode == "viewing":
            heading = "Viewing request received"
            body_line = "We've received your viewing request and will be in touch shortly to confirm a date and time that works for you."
            next_steps = [
                "We'll contact you within 1 business day to confirm your viewing slot.",
                "Please have photo ID ready for the viewing.",
                "Feel free to reply to this email with any questions.",
            ]
        elif mode == "apply":
            heading = "Application received"
            body_line = "Thank you for applying. We'll review your application and be in touch shortly."
            next_steps = [
                "We'll review your application within 2 business days.",
                "We may ask you to complete a referencing check.",
                "Feel free to reply to this email with any questions.",
            ]
        else:
            heading = "Enquiry received"
            body_line = "Thanks for getting in touch — we'll get back to you as soon as possible."
            next_steps = [
                "We'll be in touch shortly.",
                "Feel free to reply to this email with any questions.",
            ]
        steps_html = "".join(
            f'<li style="margin-bottom:8px;color:#374151">{s}</li>' for s in next_steps
        )
        prop_line = f'<p style="margin:0 0 8px"><strong>Property:</strong> {property_name}</p>' if property_name else ""
        html = f"""<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto">
          <div style="background:{brand};padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">{heading}</h1>
            <p style="color:#e0e7ff;margin:4px 0 0;font-size:14px">{org.name}</p>
          </div>
          <div style="padding:28px 32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
            <p style="color:#374151;font-size:15px">Hi {applicant_name.split()[0]},</p>
            <p style="color:#374151;font-size:15px">{body_line}</p>
            <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0">
              <p style="margin:0 0 8px"><strong>Name:</strong> {applicant_name}</p>
              {prop_line}
            </div>
            <p style="color:#374151;font-size:14px;font-weight:600;margin:20px 0 8px">What happens next:</p>
            <ol style="padding-left:20px;margin:0 0 24px">{steps_html}</ol>
            <p style="color:#6b7280;font-size:13px;border-top:1px solid #e5e7eb;padding-top:16px;margin:0">
              This email was sent by {org.name}.
              {f'You can reach us at <a href="mailto:{org.email}" style="color:{brand}">{org.email}</a>.' if org.email else ''}
            </p>
          </div>
        </div>"""
        subject_map = {"viewing": f"Viewing request confirmed — {property_name or org.name}", "apply": f"Application received — {property_name or org.name}"}
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject_map.get(mode, f"Enquiry received — {org.name}")
        msg["From"] = f"{org.name} <{settings.smtp_from}>"
        msg["To"] = applicant_email
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, applicant_email, msg.as_string())
    except Exception as e:
        print(f"[public] Confirmation email failed: {e}")


@router.post("/{slug}/enquiry", status_code=201)
def public_enquiry(slug: str, req: EnquiryRequest, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    property_name = unit_name = ""
    if req.property_id:
        prop = db.query(Property).filter(Property.id == req.property_id, Property.organisation_id == org.id).first()
        if not prop:
            raise HTTPException(status_code=400, detail="Property not found")
        property_name = prop.name
    if req.unit_id:
        unit = db.query(Unit).filter(Unit.id == req.unit_id).first()
        if unit:
            unit_name = unit.name
    applicant = Applicant(
        organisation_id=org.id,
        property_id=req.property_id,
        unit_id=req.unit_id,
        full_name=req.full_name,
        email=req.email,
        phone=req.phone or None,
        source="Direct",
        status="enquiry",
        notes=req.message or None,
    )
    db.add(applicant)
    db.commit()
    _send_enquiry_email(org, req.full_name, req.email, req.phone, req.message, property_name, unit_name)
    _send_confirmation_email(org, req.full_name, req.email, property_name, "enquiry")
    return {"ok": True, "message": "Enquiry received — the agency will be in touch soon."}


# ── Saved searches ────────────────────────────────────────────────────────

class SaveSearchRequest(BaseModel):
    email: EmailStr
    label: str = ""
    filters: dict = {}


def _send_saved_search_confirm(org, email: str, label: str, matching_props: list, token: str):
    """Send confirmation email with matching properties + unsubscribe link."""
    if not settings.smtp_host or not settings.smtp_user:
        return
    try:
        import smtplib, ssl
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        prop_rows = ""
        for p in matching_props[:8]:
            rent = min(u["monthly_rent"] for u in p["units"]) if p["units"] else 0
            prop_rows += f"""
            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start">
              <div style="flex:1">
                <p style="margin:0;font-weight:600;color:#111827">{p['name']}</p>
                <p style="margin:2px 0 0;font-size:13px;color:#6b7280">{p['address_line1']}, {p['city']} {p['postcode']}</p>
                <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:{org.brand_color or '#4f46e5'}">£{rent:,.0f}/mo</p>
              </div>
            </div>"""

        unsubscribe_url = f"https://propairty.co.uk/api/public/{org.slug}/save-search/{token}/unsubscribe"
        html = f"""<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto">
          <div style="background:{org.brand_color or '#4f46e5'};padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">Search Alert Saved</h1>
            <p style="color:#e0e7ff;margin:4px 0 0;font-size:14px">{org.name} · {label or 'Your search'}</p>
          </div>
          <div style="padding:28px 32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
            <p style="color:#374151">We've saved your search. You'll receive an email when new matching properties are listed.</p>
            <h3 style="font-size:14px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:20px 0 12px">
              {len(matching_props)} propert{'ies' if len(matching_props) != 1 else 'y'} currently match
            </h3>
            {prop_rows or '<p style="color:#9ca3af;font-size:14px">No properties currently match — we\'ll alert you when one is listed.</p>'}
            <a href="https://propairty.co.uk/site/{org.slug}"
               style="display:inline-block;background:{org.brand_color or '#4f46e5'};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px">
              Browse all properties →
            </a>
            <p style="font-size:12px;color:#9ca3af;margin-top:24px">
              <a href="{unsubscribe_url}" style="color:#9ca3af">Unsubscribe from this alert</a>
            </p>
          </div>
        </div>"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Search alert saved — {label or org.name}"
        msg["From"] = settings.smtp_from
        msg["To"] = email
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, email, msg.as_string())
        print(f"[public] Saved search confirmation sent to {email}")
    except Exception as e:
        print(f"[public] Saved search email failed: {e}")


@router.post("/{slug}/save-search", status_code=201)
def save_search(slug: str, req: SaveSearchRequest, db: Session = Depends(get_db)):
    org = _get_org(slug, db)

    # Check for duplicate
    existing = db.query(SavedSearch).filter(
        SavedSearch.organisation_id == org.id,
        SavedSearch.email == req.email,
    ).first()
    if existing:
        existing.label = req.label or existing.label
        existing.filters_json = json.dumps(req.filters)
        db.commit()
        token = existing.token
    else:
        ss = SavedSearch(
            organisation_id=org.id,
            email=req.email,
            label=req.label or "My search",
            filters_json=json.dumps(req.filters),
        )
        db.add(ss)
        db.commit()
        db.refresh(ss)
        token = ss.token

    # Get current matching properties for the confirmation email
    props = db.query(Property).filter(Property.organisation_id == org.id).all()
    matching = []
    for p in props:
        vacant = [u for u in p.units if u.status == "vacant"]
        if vacant:
            photos_q = db.query(UploadedFile).filter(
                UploadedFile.entity_type == "property",
                UploadedFile.entity_id == p.id,
                UploadedFile.organisation_id == org.id,
            ).first()
            photo_url = f"/uploads/{photos_q.filename}" if photos_q else None
            matching.append(_prop_dict(p, [photo_url] if photo_url else [], org.id))

    _send_saved_search_confirm(org, req.email, req.label, matching, token)
    return {"ok": True, "token": token}


@router.get("/{slug}/save-search/{token}/unsubscribe")
def unsubscribe_search(slug: str, token: str, db: Session = Depends(get_db)):
    ss = db.query(SavedSearch).filter(SavedSearch.token == token).first()
    if ss:
        db.delete(ss)
        db.commit()
    return {"ok": True, "message": "You have been unsubscribed from this search alert."}


# ── About / Extended profile ───────────────────────────────────────────────

@router.get("/{slug}/about")
def public_about(slug: str, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    properties_count = db.query(Property).filter(Property.organisation_id == org.id).count()
    return {
        "name": org.name,
        "slug": org.slug,
        "email": org.email,
        "phone": org.phone,
        "logo_url": org.logo_url,
        "brand_color": org.brand_color,
        "tagline": org.tagline,
        "address_text": org.address_text,
        "website_url": org.website_url,
        "about_text": org.about_text,
        "founded_year": org.founded_year,
        "properties_count": properties_count,
        "team": json.loads(org.team_json) if org.team_json else [],
        "opening_hours": json.loads(org.opening_hours_json) if org.opening_hours_json else [],
        "areas": json.loads(org.areas_json) if org.areas_json else [],
        "social_facebook": org.social_facebook,
        "social_instagram": org.social_instagram,
        "social_twitter": org.social_twitter,
    }


# ── Reviews ───────────────────────────────────────────────────────────────

@router.get("/{slug}/reviews")
def public_reviews(slug: str, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    reviews = db.query(PublicReview).filter(
        PublicReview.organisation_id == org.id,
        PublicReview.approved == True,
    ).order_by(PublicReview.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "reviewer_name": r.reviewer_name,
            "reviewer_type": r.reviewer_type,
            "rating": r.rating,
            "body": r.body,
            "property_name": r.property_name,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reviews
    ]


class ReviewRequest(BaseModel):
    reviewer_name: str
    reviewer_type: str = "tenant"
    rating: int
    body: str
    property_name: str = ""


@router.post("/{slug}/reviews", status_code=201)
def submit_review(slug: str, req: ReviewRequest, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    if not (1 <= req.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be 1–5")
    review = PublicReview(
        organisation_id=org.id,
        reviewer_name=req.reviewer_name,
        reviewer_type=req.reviewer_type,
        rating=req.rating,
        body=req.body,
        property_name=req.property_name or None,
        approved=False,  # pending approval
    )
    db.add(review)
    db.commit()
    return {"ok": True, "message": "Thank you! Your review will appear after moderation."}


# ── Blog ──────────────────────────────────────────────────────────────────

@router.get("/{slug}/blog")
def public_blog(slug: str, category: str = None, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    q = db.query(BlogPost).filter(
        BlogPost.organisation_id == org.id,
        BlogPost.published_at != None,
    )
    if category:
        q = q.filter(BlogPost.category == category)
    posts = q.order_by(BlogPost.published_at.desc()).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "excerpt": p.excerpt,
            "cover_url": p.cover_url,
            "category": p.category,
            "published_at": p.published_at.isoformat() if p.published_at else None,
        }
        for p in posts
    ]


@router.get("/{slug}/blog/{post_slug}")
def public_blog_post(slug: str, post_slug: str, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    post = db.query(BlogPost).filter(
        BlogPost.organisation_id == org.id,
        BlogPost.slug == post_slug,
        BlogPost.published_at != None,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "excerpt": post.excerpt,
        "body": post.body,
        "cover_url": post.cover_url,
        "category": post.category,
        "published_at": post.published_at.isoformat() if post.published_at else None,
    }


# ── Contact form ──────────────────────────────────────────────────────────

class ContactRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str = ""
    subject: str = ""
    message: str


@router.post("/{slug}/contact", status_code=201)
def public_contact(slug: str, req: ContactRequest, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    if not settings.smtp_host or not settings.smtp_user or not org.email:
        return {"ok": True, "message": "Message noted."}
    try:
        import smtplib, ssl
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        phone_line = f"<p><strong>Phone:</strong> {req.phone}</p>" if req.phone else ""
        subj_line = f"<p><strong>Subject:</strong> {req.subject}</p>" if req.subject else ""
        html = f"""<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto">
          <div style="background:{org.brand_color or '#4f46e5'};padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">New Contact Message</h1>
            <p style="color:#e0e7ff;margin:4px 0 0;font-size:14px">{org.name}</p>
          </div>
          <div style="padding:28px 32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
            <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0">
              <p style="margin:0 0 8px"><strong>Name:</strong> {req.full_name}</p>
              <p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:{req.email}">{req.email}</a></p>
              {phone_line}{subj_line}
              <p style="margin:8px 0 0"><strong>Message:</strong><br>{req.message.replace(chr(10),'<br>')}</p>
            </div>
          </div>
        </div>"""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Website enquiry — {req.subject or req.full_name}"
        msg["From"] = settings.smtp_from
        msg["To"] = org.email
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, org.email, msg.as_string())
    except Exception as e:
        print(f"[public] Contact email failed: {e}")
    return {"ok": True, "message": "Message sent — we'll be in touch soon."}


# ── Valuation request ─────────────────────────────────────────────────────

class ValuationReq(BaseModel):
    full_name: str
    email: EmailStr
    phone: str = ""
    address: str
    property_type: str = ""
    bedrooms: int | None = None
    message: str = ""


@router.post("/{slug}/valuation-request", status_code=201)
def public_valuation(slug: str, req: ValuationReq, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    vr = ValuationRequest(
        organisation_id=org.id,
        full_name=req.full_name,
        email=req.email,
        phone=req.phone or None,
        address=req.address,
        property_type=req.property_type or None,
        bedrooms=req.bedrooms,
        message=req.message or None,
    )
    db.add(vr)
    db.commit()
    # Notify agency by email
    if settings.smtp_host and settings.smtp_user and org.email:
        try:
            import smtplib, ssl
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            beds_line = f"<p><strong>Bedrooms:</strong> {req.bedrooms}</p>" if req.bedrooms else ""
            type_line = f"<p><strong>Property type:</strong> {req.property_type}</p>" if req.property_type else ""
            msg_line  = f"<p><strong>Message:</strong><br>{req.message}</p>" if req.message else ""
            html = f"""<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto">
              <div style="background:{org.brand_color or '#4f46e5'};padding:24px 32px;border-radius:12px 12px 0 0">
                <h1 style="color:#fff;margin:0;font-size:20px">New Valuation Request</h1>
                <p style="color:#e0e7ff;margin:4px 0 0;font-size:14px">{org.name}</p>
              </div>
              <div style="padding:28px 32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
                <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0">
                  <p style="margin:0 0 8px"><strong>Name:</strong> {req.full_name}</p>
                  <p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:{req.email}">{req.email}</a></p>
                  <p style="margin:0 0 8px"><strong>Phone:</strong> {req.phone or 'Not provided'}</p>
                  <p style="margin:0 0 8px"><strong>Address:</strong> {req.address}</p>
                  {type_line}{beds_line}{msg_line}
                </div>
              </div>
            </div>"""
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"New valuation request — {req.address}"
            msg["From"] = settings.smtp_from
            msg["To"] = org.email
            msg.attach(MIMEText(html, "html"))
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_user, org.email, msg.as_string())
        except Exception as e:
            print(f"[public] Valuation email failed: {e}")
    return {"ok": True, "message": "Valuation request received — we'll be in touch within 24 hours."}


# ── PDF Brochure (cached, auto-generated) ──────────────────────────────────

@router.get("/{slug}/property/{property_id}/brochure.pdf")
def property_brochure_pdf(slug: str, property_id: int, db: Session = Depends(get_db)):
    """Serve a cached professional PDF brochure, regenerating only when content changes."""
    from app.brochure import get_or_generate_brochure

    org = _get_org(slug, db)
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organisation_id == org.id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    photo_urls, floorplan_url, brochure_url = _fetch_photos_and_floorplan(db, prop, org.id)

    # If a manually uploaded brochure PDF exists, serve it directly
    if brochure_url:
        import os
        path = os.path.join("/root/propairty/backend/uploads", brochure_url.lstrip("/uploads/"))
        if os.path.exists(path):
            with open(path, "rb") as f:
                return Response(f.read(), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{prop.name}.pdf"'})

    try:
        pdf_bytes = get_or_generate_brochure(prop, photo_urls, org, floorplan_url)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    return Response(
        pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{prop.name} - Brochure.pdf"'},
    )


# ── Public AI chat (Wendy / Mendy) ─────────────────────────────────────────

# Simple in-memory rate limiter: ip → (count, window_start)
_chat_rate: dict[str, tuple[int, float]] = {}
_CHAT_LIMIT = 30   # messages per window
_CHAT_WINDOW = 300  # 5 minutes

def _build_public_context(org, props: list) -> str:
    agent_name = getattr(org, "ai_agent_name", None) or "Wendy"
    lines = [
        f"You are {agent_name}, a friendly and knowledgeable AI letting agent for {org.name}.",
        f"You help prospective tenants find the right rental property and answer their questions.",
        "",
        f"Agency: {org.name}",
        f"Phone: {org.phone or 'see website'}" ,
        f"Email: {org.email or 'see website'}",
        f"Address: {org.address_text or ''}",
        "",
        "YOUR ROLE:",
        "1. Help visitors find properties matching their needs (beds, budget, area, furnished, pet-friendly, etc.)",
        "2. Answer questions about specific listings — amenities, room sizes, EPC, council tax, deposit amounts",
        "3. Help them book a viewing — collect their name, email, phone, preferred date/time and confirm you'll pass it to the team",
        "4. Answer general renting questions (referencing, AST, deposits, Right to Rent, etc.)",
        "5. If they want to apply or have a complex question you can't answer, direct them to call or email the agency",
        "",
        "STYLE: Friendly, concise, British English. Use the property names and prices from the data below.",
        "Never invent details not listed. Never claim to directly book anything — you pass enquiries to the agent team.",
        "",
        "CURRENTLY AVAILABLE PROPERTIES:",
    ]

    for p in props:
        vacant = [u for u in p["units"]]
        if not vacant:
            continue
        addr = f"{p.get('address_line1','')}, {p.get('city','')}"
        for u in vacant:
            beds = "Studio" if u["bedrooms"] == 0 else f"{u['bedrooms']} bed"
            baths = f"{u['bathrooms']} bath"
            rent_mo = f"£{int(u['monthly_rent']):,}/mo"
            rent_pw = f"£{round(u['monthly_rent']*12/52):,}/pw"
            furnished = u.get("furnished") or "ask agent"
            avail = u.get("available_from") or "now"
            amenities = ", ".join(u.get("amenities", [])[:8]) or "ask agent"
            lines.append(
                f"  • {p['name']} — {u['name']}: {beds}, {baths}, {rent_mo} ({rent_pw})"
                f" — {addr}, {p.get('postcode','')} — furnished: {furnished}"
                f" — available: {avail} — amenities: {amenities}"
                f" — ref: {p.get('reference_number') or ('PROP-' + str(p['id']).zfill(4))}"
            )

    lines += [
        "",
        "When suggesting a property, mention its name and price clearly.",
        "When a user wants to book a viewing, ask for: full name, email, phone, preferred date/time, and which property/unit.",
        f"End every viewing request confirmation with: 'I'll pass your details to the {org.name} team and they'll be in touch shortly.'",
    ]
    from app.ai_utils import data_boundary
    lines.append(data_boundary())
    return "\n".join(lines)


@router.post("/{slug}/chat")
async def public_chat(slug: str, req: PublicChatRequest, request: Request, db: Session = Depends(get_db)):
    """Public AI chat — no auth required. Rate-limited per IP."""
    # Rate limit
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    count, window_start = _chat_rate.get(ip, (0, now))
    if now - window_start > _CHAT_WINDOW:
        count, window_start = 0, now
    if count >= _CHAT_LIMIT:
        raise HTTPException(status_code=429, detail="Too many messages — please wait a few minutes.")
    _chat_rate[ip] = (count + 1, window_start)

    org = _get_org(slug, db)

    # Fetch available properties (same as the listings endpoint)
    all_props = db.query(Property).filter(Property.organisation_id == org.id).all()
    props_data = []
    for p in all_props:
        vacant = [u for u in p.units if u.status == "vacant"]
        if not vacant:
            continue
        try:
            amenities = json.loads(vacant[0].amenities or "[]")
        except Exception:
            amenities = []
        units_data = []
        for u in vacant:
            try:
                ams = json.loads(u.amenities or "[]")
            except Exception:
                ams = []
            units_data.append({
                "bedrooms": u.bedrooms or 0,
                "bathrooms": u.bathrooms or 1,
                "monthly_rent": float(u.monthly_rent),
                "furnished": u.furnished,
                "available_from": u.available_from.isoformat() if u.available_from else None,
                "amenities": ams,
                "name": u.name,
            })
        props_data.append({
            "id": p.id,
            "name": p.name,
            "address_line1": p.address_line1,
            "city": p.city,
            "postcode": p.postcode,
            "reference_number": p.reference_number,
            "units": units_data,
        })

    system_prompt = _build_public_context(org, props_data)
    messages_in = [{"role": m.role, "content": m.content} for m in req.messages]

    # Try Anthropic Claude first
    if settings.anthropic_api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system_prompt,
                messages=messages_in,
            )
            reply = resp.content[0].text.strip() if resp.content else ""
            return {"reply": reply, "agent": getattr(org, "ai_agent_name", None) or "Wendy"}
        except Exception as e:
            print(f"[public chat] Anthropic error: {e}")

    from app.ai_utils import openrouter_chat
    reply = openrouter_chat([{"role": "system", "content": system_prompt}] + messages_in)
    if reply:
        return {"reply": reply, "agent": getattr(org, "ai_agent_name", None) or "Wendy"}

    raise HTTPException(status_code=503, detail="AI chat is temporarily unavailable.")


# ── Public user accounts ──────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str = ""
    password: str
    role: str = "tenant"  # tenant | landlord


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class BookViewingRequest(BaseModel):
    property_id: int
    unit_id: int | None = None
    full_name: str
    email: EmailStr
    phone: str = ""
    preferred_date: str = ""
    message: str = ""


class ApplyRequest(BaseModel):
    property_id: int
    unit_id: int | None = None
    full_name: str
    email: EmailStr
    phone: str = ""
    desired_move_in: str = ""
    monthly_budget: str = ""
    message: str = ""


def _get_public_user(slug: str, request: Request, db: Session) -> PublicUser:
    """Decode Bearer token and return the PublicUser, or raise 401."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub", 0))
        if payload.get("type") != "public_user":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(PublicUser).filter(PublicUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    org = _get_org(slug, db)
    if user.organisation_id != org.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return user


@router.post("/{slug}/account/register", status_code=201)
def public_register(slug: str, req: RegisterRequest, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    existing = db.query(PublicUser).filter(
        PublicUser.organisation_id == org.id,
        PublicUser.email == req.email.lower(),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    role = req.role if req.role in ("tenant", "landlord") else "tenant"
    user = PublicUser(
        organisation_id=org.id,
        email=req.email.lower(),
        full_name=req.full_name,
        phone=req.phone or None,
        hashed_password=hash_password(req.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "type": "public_user"})
    return {"access_token": token, "token_type": "bearer", "full_name": user.full_name, "email": user.email, "role": user.role}


@router.post("/{slug}/account/token")
def public_login(slug: str, req: LoginRequest, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    user = db.query(PublicUser).filter(
        PublicUser.organisation_id == org.id,
        PublicUser.email == req.email.lower(),
    ).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = create_access_token({"sub": str(user.id), "type": "public_user"})
    return {"access_token": token, "token_type": "bearer", "full_name": user.full_name, "email": user.email, "role": user.role}


@router.get("/{slug}/account/me")
def public_me(slug: str, request: Request, db: Session = Depends(get_db)):
    user = _get_public_user(slug, request, db)
    saved_ids = [sp.property_id for sp in user.saved_properties]
    return {"id": user.id, "full_name": user.full_name, "email": user.email, "phone": user.phone, "role": user.role, "saved_property_ids": saved_ids}


class PublicProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class PublicPasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.patch("/{slug}/account/me")
def public_update_me(slug: str, data: PublicProfileUpdate, request: Request, db: Session = Depends(get_db)):
    user = _get_public_user(slug, request, db)
    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.phone is not None:
        user.phone = data.phone.strip()
    db.commit()
    return {"id": user.id, "full_name": user.full_name, "email": user.email, "phone": user.phone, "role": user.role}


@router.post("/{slug}/account/me/change-password")
def public_change_password(slug: str, data: PublicPasswordChange, request: Request, db: Session = Depends(get_db)):
    from app.auth import verify_password, hash_password
    user = _get_public_user(slug, request, db)
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


@router.post("/{slug}/account/saved/{property_id}", status_code=201)
def save_property(slug: str, property_id: int, request: Request, db: Session = Depends(get_db)):
    user = _get_public_user(slug, request, db)
    org = _get_org(slug, db)
    prop = db.query(Property).filter(Property.id == property_id, Property.organisation_id == org.id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    existing = db.query(SavedProperty).filter(
        SavedProperty.public_user_id == user.id,
        SavedProperty.property_id == property_id,
    ).first()
    if existing:
        return {"ok": True}
    db.add(SavedProperty(public_user_id=user.id, property_id=property_id))
    db.commit()
    return {"ok": True}


@router.delete("/{slug}/account/saved/{property_id}")
def unsave_property(slug: str, property_id: int, request: Request, db: Session = Depends(get_db)):
    user = _get_public_user(slug, request, db)
    sp = db.query(SavedProperty).filter(
        SavedProperty.public_user_id == user.id,
        SavedProperty.property_id == property_id,
    ).first()
    if sp:
        db.delete(sp)
        db.commit()
    return {"ok": True}


@router.get("/{slug}/account/saved")
def get_saved_properties(slug: str, request: Request, db: Session = Depends(get_db)):
    user = _get_public_user(slug, request, db)
    org = _get_org(slug, db)
    saved = db.query(SavedProperty).filter(SavedProperty.public_user_id == user.id).all()
    props = []
    for sp in saved:
        prop = db.query(Property).filter(Property.id == sp.property_id, Property.organisation_id == org.id).first()
        if prop:
            photos, floorplan_url, brochure_url = _fetch_photos_and_floorplan(db, prop, org.id)
            props.append(_prop_dict(prop, photos, org.id, floorplan_url, brochure_url))
    return props


@router.get("/{slug}/account/applications")
def get_my_applications(slug: str, request: Request, db: Session = Depends(get_db)):
    user = _get_public_user(slug, request, db)
    org = _get_org(slug, db)
    applicants = (
        db.query(Applicant)
        .filter(
            Applicant.organisation_id == org.id,
            Applicant.email == user.email,
        )
        .order_by(Applicant.created_at.desc())
        .all()
    )
    results = []
    for a in applicants:
        prop_name = a.property.name if a.property else None
        prop_address = None
        prop_photo = None
        if a.property:
            p = a.property
            parts = [p.address_line1, p.address_line2, p.city, p.postcode]
            prop_address = ", ".join(x for x in parts if x)
            photos, _, _ = _fetch_photos_and_floorplan(db, p, org.id)
            prop_photo = photos[0] if photos else None
        unit_name = a.unit.name if a.unit else None
        results.append({
            "id": a.id,
            "status": a.status,
            "property_id": a.property_id,
            "property_name": prop_name,
            "property_address": prop_address,
            "property_photo": prop_photo,
            "unit_name": unit_name,
            "viewing_date": a.viewing_date.isoformat() if a.viewing_date else None,
            "desired_move_in": a.desired_move_in.isoformat() if a.desired_move_in else None,
            "monthly_budget": a.monthly_budget,
            "referencing_status": a.referencing_status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return results


@router.post("/{slug}/account/applications/{applicant_id}/cancel")
def cancel_application(slug: str, applicant_id: int, request: Request, db: Session = Depends(get_db)):
    user = _get_public_user(slug, request, db)
    org = _get_org(slug, db)
    applicant = db.query(Applicant).filter(
        Applicant.id == applicant_id,
        Applicant.organisation_id == org.id,
        Applicant.email == user.email,
    ).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Application not found")
    if applicant.status in ("rejected", "withdrawn", "tenancy_created"):
        raise HTTPException(status_code=400, detail="Cannot cancel this application")
    applicant.status = "withdrawn"
    db.commit()
    if applicant.email:
        _send_withdrawal_email(applicant)
    return {"ok": True}


def _send_withdrawal_email(applicant: Applicant):
    first = applicant.full_name.split()[0]
    prop_str = ""
    if applicant.property:
        p = applicant.property
        prop_str = f"<p><strong>Property:</strong> {p.address_line1}, {p.city}</p>"
    subject = "Your application has been withdrawn"
    body = (
        f"<p>Hi {first},</p>"
        f"<p>Your application has been withdrawn as requested.</p>"
        f"{prop_str}"
        f"<p>If you change your mind or would like to discuss other properties, don't hesitate to get in touch.</p>"
    )
    try:
        emails._send_email(applicant.email, subject, emails._base_template(subject, body, "PropAIrty"))
    except Exception as e:
        print(f"[email] withdrawal email failed: {e}")


@router.post("/{slug}/book-viewing", status_code=201)
def book_viewing(slug: str, req: BookViewingRequest, db: Session = Depends(get_db)):
    org = _get_org(slug, db)
    property_name = unit_name = ""
    if req.property_id:
        prop = db.query(Property).filter(Property.id == req.property_id, Property.organisation_id == org.id).first()
        if prop:
            property_name = prop.name
    if req.unit_id:
        unit = db.query(Unit).filter(Unit.id == req.unit_id).first()
        if unit:
            unit_name = unit.name
    notes = f"Preferred date: {req.preferred_date}\n{req.message}".strip() if req.preferred_date else req.message or None
    applicant = Applicant(
        organisation_id=org.id,
        property_id=req.property_id,
        unit_id=req.unit_id,
        full_name=req.full_name,
        email=req.email,
        phone=req.phone or None,
        source="Direct",
        status="viewing_booked",
        notes=notes,
    )
    db.add(applicant)
    db.commit()
    _send_enquiry_email(org, req.full_name, req.email, req.phone, notes, property_name, unit_name)
    _send_confirmation_email(org, req.full_name, req.email, property_name, "viewing")
    return {"ok": True, "message": "Viewing request received — the agency will confirm shortly."}


@router.post("/{slug}/apply", status_code=201)
def apply_for_property(slug: str, req: ApplyRequest, db: Session = Depends(get_db)):
    from datetime import date as _date
    org = _get_org(slug, db)
    property_name = unit_name = ""
    if req.property_id:
        prop = db.query(Property).filter(Property.id == req.property_id, Property.organisation_id == org.id).first()
        if prop:
            property_name = prop.name
    if req.unit_id:
        unit = db.query(Unit).filter(Unit.id == req.unit_id).first()
        if unit:
            unit_name = unit.name
    move_in = None
    if req.desired_move_in:
        try:
            move_in = _date.fromisoformat(req.desired_move_in)
        except ValueError:
            pass
    applicant = Applicant(
        organisation_id=org.id,
        property_id=req.property_id,
        unit_id=req.unit_id,
        full_name=req.full_name,
        email=req.email,
        phone=req.phone or None,
        source="Direct",
        status="enquiry",
        desired_move_in=move_in,
        monthly_budget=req.monthly_budget or None,
        notes=req.message or None,
    )
    db.add(applicant)
    db.commit()
    _send_enquiry_email(org, req.full_name, req.email, req.phone, req.message, property_name, unit_name)
    _send_confirmation_email(org, req.full_name, req.email, property_name, "apply")
    return {"ok": True, "message": "Application received — the agency will be in touch soon."}



@router.get("/{slug}/features")
def get_public_features(slug: str, db: Session = Depends(get_db)):
    """Return public-facing feature flags for a given org slug (no auth required)."""
    from app import feature_flags as ff
    org = db.query(Organisation).filter(Organisation.slug == slug).first()
    if not org:
        return {}
    return ff.get_org_features(db, org.id, prefix="public_")


# ── Agent blog post management ─────────────────────────────────────────────────

from app.auth import get_current_user
from app.models.user import User
from datetime import datetime as _dt
import re as _re

def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = _re.sub(r'[^\w\s-]', '', text)
    return _re.sub(r'[\s_-]+', '-', text)[:80]

class BlogPostIn(BaseModel):
    title: str
    excerpt: str = ""
    body: str = ""
    cover_url: str = ""
    category: str = "post"   # post | tenant_advice | landlord_advice | market | tips | area
    published: bool = True

@router.get("/agent/blog-posts")
def agent_list_posts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    posts = (
        db.query(BlogPost)
        .filter(BlogPost.organisation_id == current_user.organisation_id)
        .order_by(BlogPost.created_at.desc())
        .all()
    )
    return [
        {
            "id": p.id, "title": p.title, "slug": p.slug,
            "category": p.category, "excerpt": p.excerpt,
            "published": p.published_at is not None,
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in posts
    ]

@router.post("/agent/blog-posts", status_code=201)
def agent_create_post(body: BlogPostIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    base_slug = _slugify(body.title) or "post"
    slug = base_slug
    n = 1
    while db.query(BlogPost).filter_by(organisation_id=current_user.organisation_id, slug=slug).first():
        slug = f"{base_slug}-{n}"; n += 1
    post = BlogPost(
        organisation_id=current_user.organisation_id,
        title=body.title.strip(),
        slug=slug,
        excerpt=body.excerpt.strip(),
        body=body.body.strip(),
        cover_url=body.cover_url.strip() or None,
        category=body.category,
        published_at=_dt.utcnow() if body.published else None,
    )
    db.add(post); db.commit(); db.refresh(post)
    return {"id": post.id, "slug": post.slug}

@router.put("/agent/blog-posts/{post_id}")
def agent_update_post(post_id: int, body: BlogPostIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(BlogPost).filter_by(id=post_id, organisation_id=current_user.organisation_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    post.title = body.title.strip()
    post.excerpt = body.excerpt.strip()
    post.body = body.body.strip()
    post.cover_url = body.cover_url.strip() or None
    post.category = body.category
    if body.published and not post.published_at:
        post.published_at = _dt.utcnow()
    elif not body.published:
        post.published_at = None
    db.commit()
    return {"ok": True}

@router.delete("/agent/blog-posts/{post_id}")
def agent_delete_post(post_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(BlogPost).filter_by(id=post_id, organisation_id=current_user.organisation_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    db.delete(post); db.commit()
    return {"ok": True}
