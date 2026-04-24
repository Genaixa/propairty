from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.applicant import Applicant, STAGES, TERMINAL_STAGES
from app.models.property import Property
from app.models.unit import Unit
from app.models.tenant import Tenant
from app.models.lease import Lease
from app import notifications, emails
import html

router = APIRouter(prefix="/api/applicants", tags=["applicants"])


def _out(a: Applicant):
    prop = a.property
    unit = a.unit
    return {
        "id": a.id,
        "full_name": a.full_name,
        "email": a.email,
        "phone": a.phone,
        "source": a.source,
        "status": a.status,
        "viewing_date": a.viewing_date.isoformat() if a.viewing_date else None,
        "desired_move_in": a.desired_move_in.isoformat() if a.desired_move_in else None,
        "monthly_budget": a.monthly_budget,
        "notes": a.notes,
        "property_id": a.property_id,
        "unit_id": a.unit_id,
        "property_name": prop.name if prop else None,
        "unit_name": unit.name if unit else None,
        "property_address": f"{prop.address_line1}, {prop.city}" if prop else None,
        "right_to_rent_checked": a.right_to_rent_checked,
        "referencing_status": a.referencing_status,
        # Preferences
        "preferred_areas": a.preferred_areas or "",
        "must_haves": a.must_haves or "",
        "dislikes": a.dislikes or "",
        "min_bedrooms": a.min_bedrooms,
        "max_bedrooms": a.max_bedrooms,
        # Follow-up
        "follow_up_date": a.follow_up_date.isoformat() if a.follow_up_date else None,
        "follow_up_note": a.follow_up_note or "",
        "assigned_agent": a.assigned_agent or "",
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


class ApplicantCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    property_id: Optional[int] = None
    unit_id: Optional[int] = None
    viewing_date: Optional[datetime] = None
    desired_move_in: Optional[date] = None
    monthly_budget: Optional[str] = None
    notes: Optional[str] = None
    status: str = "enquiry"
    preferred_areas: Optional[str] = None
    must_haves: Optional[str] = None
    dislikes: Optional[str] = None
    min_bedrooms: Optional[int] = None
    max_bedrooms: Optional[int] = None
    follow_up_date: Optional[date] = None
    follow_up_note: Optional[str] = None
    assigned_agent: Optional[str] = None


class ApplicantUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    property_id: Optional[int] = None
    unit_id: Optional[int] = None
    viewing_date: Optional[datetime] = None
    desired_move_in: Optional[date] = None
    monthly_budget: Optional[str] = None
    notes: Optional[str] = None
    right_to_rent_checked: Optional[bool] = None
    referencing_status: Optional[str] = None
    preferred_areas: Optional[str] = None
    must_haves: Optional[str] = None
    dislikes: Optional[str] = None
    min_bedrooms: Optional[int] = None
    max_bedrooms: Optional[int] = None
    follow_up_date: Optional[date] = None
    follow_up_note: Optional[str] = None
    assigned_agent: Optional[str] = None


@router.get("")
def list_applicants(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Applicant).filter(Applicant.organisation_id == current_user.organisation_id)
    if status:
        q = q.filter(Applicant.status == status)
    return [_out(a) for a in q.order_by(Applicant.created_at.desc()).all()]


@router.get("/pipeline")
def pipeline_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_applicants = db.query(Applicant).filter(
        Applicant.organisation_id == current_user.organisation_id
    ).all()
    counts = {s: 0 for s in STAGES + TERMINAL_STAGES}
    for a in all_applicants:
        if a.status in counts:
            counts[a.status] += 1
    return {
        "counts": counts,
        "total_active": sum(counts[s] for s in STAGES),
        "total": len(all_applicants),
    }


@router.post("")
def create_applicant(
    data: ApplicantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify property/unit belong to org if given
    if data.property_id:
        prop = db.query(Property).filter(
            Property.id == data.property_id,
            Property.organisation_id == current_user.organisation_id,
        ).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

    applicant = Applicant(
        organisation_id=current_user.organisation_id,
        **data.model_dump(),
    )
    db.add(applicant)
    db.commit()
    db.refresh(applicant)

    # Telegram alert for new applicant
    prop = applicant.property
    unit = applicant.unit
    location = f"{prop.name}{' · ' + unit.name if unit else ''}" if prop else "unspecified property"
    notifications.send(
        f"🏠 <b>New Applicant</b>\n\n"
        f"Name: {applicant.full_name}\n"
        f"Property: {location}\n"
        f"Source: {applicant.source or '—'}\n"
        f"Phone: {applicant.phone or '—'}"
    )

    return _out(applicant)


@router.put("/{applicant_id}")
def update_applicant(
    applicant_id: int,
    data: ApplicantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    applicant = db.query(Applicant).filter(
        Applicant.id == applicant_id,
        Applicant.organisation_id == current_user.organisation_id,
    ).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    old_status = applicant.status
    old_viewing_date = applicant.viewing_date
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(applicant, field, value)
    db.commit()
    db.refresh(applicant)

    # Send viewing confirmation email when viewing date is set or changed
    new_status = applicant.status
    viewing_date_changed = (
        data.viewing_date is not None and data.viewing_date != old_viewing_date
    )
    if viewing_date_changed and applicant.email and applicant.viewing_date:
        _send_viewing_confirmation(applicant)

    # Auto-create tenant when moved to tenancy_created
    if new_status == "tenancy_created" and old_status != "tenancy_created":
        existing = db.query(Tenant).filter(
            Tenant.organisation_id == current_user.organisation_id,
            Tenant.email == applicant.email,
        ).first() if applicant.email else None

        if not existing:
            # Try to fetch a Pexels portrait photo
            avatar_url = None
            try:
                import httpx
                from app.config import settings
                if settings.pexels_api_key:
                    r = httpx.get(
                        "https://api.pexels.com/v1/search",
                        params={"query": "professional person portrait", "per_page": 1, "orientation": "portrait"},
                        headers={"Authorization": settings.pexels_api_key},
                        timeout=5,
                    )
                    photos = r.json().get("photos", [])
                    if photos:
                        avatar_url = photos[0]["src"]["medium"]
            except Exception:
                pass

            unit = applicant.unit
            prop = applicant.property
            unit_note = f" Unit: {prop.name} · {unit.name}." if prop and unit else ""
            tenant = Tenant(
                organisation_id=current_user.organisation_id,
                full_name=applicant.full_name,
                email=applicant.email,
                phone=applicant.phone,
                avatar_url=avatar_url,
                notes=f"Created from applicant pipeline. Source: {applicant.source or '—'}.{unit_note}",
            )
            db.add(tenant)
            db.commit()

    # Alert on key stage transitions
    if new_status != old_status:
        prop = applicant.property
        unit = applicant.unit
        location = f"{prop.name}{' · ' + unit.name if unit else ''}" if prop else "—"
        stage_emoji = {
            "viewing_booked": "📅",
            "viewed": "👀",
            "referencing": "🔍",
            "approved": "✅",
            "tenancy_created": "🎉",
            "rejected": "❌",
            "withdrawn": "🚫",
        }.get(new_status, "➡️")
        notifications.send(
            f"{stage_emoji} <b>Applicant: {new_status.replace('_', ' ').title()}</b>\n\n"
            f"Applicant: {applicant.full_name}\n"
            f"Property: {location}\n"
            f"Stage: {old_status.replace('_', ' ')} → {new_status.replace('_', ' ')}"
        )
        # Email applicant on notable stage changes
        if applicant.email:
            _send_status_email(applicant)

    return _out(applicant)


class ConvertRequest(BaseModel):
    monthly_rent: float
    start_date: date
    end_date: Optional[date] = None
    deposit: Optional[float] = None
    rent_day: int = 1
    is_periodic: bool = False


@router.post("/{applicant_id}/convert")
def convert_to_tenancy(
    applicant_id: int,
    data: ConvertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Tenant + Lease from an approved applicant."""
    applicant = db.query(Applicant).filter(
        Applicant.id == applicant_id,
        Applicant.organisation_id == current_user.organisation_id,
    ).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    if not applicant.unit_id:
        raise HTTPException(status_code=400, detail="Applicant must be linked to a unit before converting")

    # Get or create tenant
    tenant = None
    if applicant.email:
        tenant = db.query(Tenant).filter(
            Tenant.organisation_id == current_user.organisation_id,
            Tenant.email == applicant.email,
        ).first()
    if not tenant:
        tenant = Tenant(
            organisation_id=current_user.organisation_id,
            full_name=applicant.full_name,
            email=applicant.email,
            phone=applicant.phone,
            notes=f"Created from applicant pipeline. Source: {applicant.source or '—'}.",
        )
        db.add(tenant)
        db.flush()

    # Create lease
    lease = Lease(
        unit_id=applicant.unit_id,
        tenant_id=tenant.id,
        start_date=data.start_date,
        end_date=data.end_date,
        monthly_rent=data.monthly_rent,
        deposit=data.deposit,
        rent_day=data.rent_day,
        is_periodic=data.is_periodic,
        status="active",
    )
    db.add(lease)

    # Mark applicant as converted
    applicant.status = "tenancy_created"
    db.commit()
    db.refresh(lease)

    unit = applicant.unit
    prop = applicant.property
    notifications.send(
        f"🎉 <b>Applicant Converted to Tenancy</b>\n\n"
        f"Tenant: {tenant.full_name}\n"
        f"Property: {prop.name if prop else '—'} · {unit.name if unit else '—'}\n"
        f"Rent: £{data.monthly_rent:,.0f}/mo · Start: {data.start_date}"
    )

    return {"tenant_id": tenant.id, "lease_id": lease.id}


@router.delete("/{applicant_id}")
def delete_applicant(
    applicant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    applicant = db.query(Applicant).filter(
        Applicant.id == applicant_id,
        Applicant.organisation_id == current_user.organisation_id,
    ).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    db.delete(applicant)
    db.commit()
    return {"ok": True}


def _send_status_email(applicant: Applicant):
    """Email applicant when their pipeline status changes to a notable stage."""
    first = html.escape(applicant.full_name.split()[0])
    prop_str = ""
    if applicant.property:
        p = applicant.property
        addr = html.escape(f"{p.address_line1}, {p.city}")
        prop_str = f"<p><strong>Property:</strong> {addr}</p>"

    messages = {
        "referencing": {
            "subject": "Referencing has started on your application",
            "heading": "Referencing Started",
            "body": (
                f"<p>Hi {first},</p>"
                f"<p>Great news — we've started your referencing checks.</p>"
                f"{prop_str}"
                f"<p>This usually takes 2–5 working days. We'll be in touch as soon as it's complete.</p>"
            ),
        },
        "approved": {
            "subject": "Your application has been approved",
            "heading": "Application Approved",
            "body": (
                f"<p>Hi {first},</p>"
                f"<p>Congratulations — your application has been approved!</p>"
                f"{prop_str}"
                f"<p>We'll be in touch shortly to arrange signing your tenancy agreement and move-in details.</p>"
            ),
        },
        "rejected": {
            "subject": "Update on your application",
            "heading": "Application Update",
            "body": (
                f"<p>Hi {first},</p>"
                f"<p>Thank you for your interest. Unfortunately on this occasion your application was unsuccessful.</p>"
                f"{prop_str}"
                f"<p>We encourage you to browse our other available properties — we may have something that's a great fit.</p>"
            ),
        },
        "withdrawn": {
            "subject": "Your application has been withdrawn",
            "heading": "Application Withdrawn",
            "body": (
                f"<p>Hi {first},</p>"
                f"<p>Your application has been withdrawn as requested.</p>"
                f"{prop_str}"
                f"<p>If you change your mind or would like to discuss other properties, don't hesitate to get in touch.</p>"
            ),
        },
    }
    msg = messages.get(applicant.status)
    if not msg:
        return
    try:
        emails._send_email(applicant.email, msg["subject"], emails._base_template(msg["subject"], msg["body"], "PropAIrty"))
    except Exception as e:
        print(f"[applicants] status email failed: {e}")


def _send_viewing_confirmation(applicant: Applicant):
    vdate = applicant.viewing_date.strftime("%-d %B %Y at %-I:%M %p") if applicant.viewing_date else "as scheduled"
    first = html.escape(applicant.full_name.split()[0])
    subject = f"Viewing confirmed — {vdate}"
    prop_str = ""
    if applicant.property:
        p = applicant.property
        addr = html.escape(f"{p.address_line1}, {p.city}")
        prop_str = f"<p><strong>Address:</strong> {addr}</p>"
    body = f"""
    <h2>Viewing Confirmed</h2>
    <p>Hi {first},</p>
    <p>Your property viewing has been booked for <strong>{vdate}</strong>.</p>
    {prop_str}
    <p>We look forward to seeing you. If you need to rearrange, please contact us as soon as possible.</p>
    """
    try:
        emails._send_email(applicant.email, subject, emails._base_template(subject, body, "PropAIrty"))
    except Exception as e:
        print(f"[applicants] viewing confirmation email failed: {e}")


@router.get("/units-available")
def available_units(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all properties and units for the dropdown."""
    props = db.query(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()
    result = []
    for p in props:
        for u in p.units:
            result.append({
                "property_id": p.id,
                "property_name": p.name,
                "unit_id": u.id,
                "unit_name": u.name,
                "label": f"{p.name} — {u.name}",
            })
    return result


@router.get("/follow-ups-due")
def follow_ups_due(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return applicants whose follow_up_date is today or overdue."""
    from datetime import date as _date
    today = _date.today()
    applicants = db.query(Applicant).filter(
        Applicant.organisation_id == current_user.organisation_id,
        Applicant.follow_up_date <= today,
        Applicant.follow_up_date != None,
        ~Applicant.status.in_(["rejected", "withdrawn", "tenancy_created"]),
    ).order_by(Applicant.follow_up_date).all()
    return [_out(a) for a in applicants]
