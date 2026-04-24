import re
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.auth import hash_password, get_current_user, create_access_token
from app.models.organisation import Organisation
from app.models.user import User
from app.schemas.auth import Token, UserOut
from app import notifications, emails

TRIAL_DAYS = 14

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:40]


def _unique_slug(base: str, db: Session) -> str:
    slug = base
    n = 2
    while db.query(Organisation).filter(Organisation.slug == slug).first():
        slug = f"{base}-{n}"
        n += 1
    return slug


class SignupRequest(BaseModel):
    org_name: str
    full_name: str
    email: EmailStr
    password: str


class InviteRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "agent"


@router.post("/signup", response_model=Token)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    slug = _unique_slug(_slugify(req.org_name), db)
    org = Organisation(
        name=req.org_name,
        slug=slug,
        subscription_status="trialing",
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS),
    )
    db.add(org)
    db.flush()

    user = User(
        organisation_id=org.id,
        email=req.email,
        full_name=req.full_name,
        hashed_password=hash_password(req.password),
        role="admin"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Welcome alert
    notifications.send(
        f"🎉 <b>New PropAIrty Signup!</b>\n\n"
        f"Organisation: <b>{org.name}</b>\n"
        f"Admin: {user.full_name} ({user.email})"
    )

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/invite", response_model=UserOut)
def invite_user(req: InviteRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite users")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        organisation_id=current_user.organisation_id,
        email=req.email,
        full_name=req.full_name,
        hashed_password=hash_password(req.password),
        role=req.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class SendInviteRequest(BaseModel):
    full_name: str
    email: EmailStr
    role: str = "agent"


@router.post("/send-invite")
def send_invite_email(req: SendInviteRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Send an email invite link. Recipient clicks link to set their own password."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite users")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=7)

    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    org_name = org.name if org else "PropAIrty"

    user = User(
        organisation_id=current_user.organisation_id,
        email=req.email,
        full_name=req.full_name,
        hashed_password=hash_password(secrets.token_hex(32)),  # unusable placeholder
        role=req.role,
        is_active=False,
        invite_token=token,
        invite_expires_at=expires,
    )
    db.add(user)
    db.commit()

    invite_url = f"https://propairty.co.uk/invite/{token}"
    body = f"""
    <h2>You've been invited to {org_name}</h2>
    <p>Hi {req.full_name.split()[0]},</p>
    <p><strong>{current_user.full_name}</strong> has invited you to join <strong>{org_name}</strong> on PropAIrty.</p>
    <p>Click the button below to set your password and activate your account. This link expires in 7 days.</p>
    <a href="{invite_url}" class="cta">Accept Invitation</a>
    <p style="margin-top:16px;font-size:12px;color:#6b7280;">Or copy this link: {invite_url}</p>
    """
    html_body = emails._base_template(f"You're invited to {org_name}", body, org_name)
    emails._send_email(req.email, f"You've been invited to join {org_name} on PropAIrty", html_body)

    return {"ok": True, "message": f"Invite sent to {req.email}"}


class AcceptInviteRequest(BaseModel):
    token: str
    password: str


@router.get("/invite-info/{token}")
def invite_info(token: str, db: Session = Depends(get_db)):
    """Public endpoint — returns name and org for the accept-invite page."""
    user = db.query(User).filter(User.invite_token == token).first()
    if not user or not user.invite_expires_at:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    if user.invite_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite link has expired")
    org = db.query(Organisation).filter(Organisation.id == user.organisation_id).first()
    return {"full_name": user.full_name, "email": user.email, "org_name": org.name if org else ""}


@router.post("/accept-invite", response_model=Token)
def accept_invite(req: AcceptInviteRequest, db: Session = Depends(get_db)):
    """Public endpoint — set password and activate account from invite token."""
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = db.query(User).filter(User.invite_token == req.token).first()
    if not user or not user.invite_expires_at:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    if user.invite_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite link has expired")
    user.hashed_password = hash_password(req.password)
    user.is_active = True
    user.invite_token = None
    user.invite_expires_at = None
    db.commit()
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/org-users", response_model=list[UserOut])
def list_org_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.user_property_assignment import UserPropertyAssignment
    users = db.query(User).filter(User.organisation_id == current_user.organisation_id).all()
    assignments = db.query(UserPropertyAssignment).filter(
        UserPropertyAssignment.user_id.in_([u.id for u in users])
    ).all()
    prop_ids_by_user = {}
    for a in assignments:
        prop_ids_by_user.setdefault(a.user_id, []).append(a.property_id)
    return [
        {
            "id": u.id, "email": u.email, "full_name": u.full_name,
            "role": u.role, "is_active": u.is_active,
            "restrict_to_assigned": u.restrict_to_assigned or False,
            "assigned_property_ids": prop_ids_by_user.get(u.id, []),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


VALID_ROLES = {"admin", "manager", "negotiator", "accounts", "read_only"}


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    password: str | None = None
    restrict_to_assigned: bool | None = None


@router.put("/org-users/{user_id}")
def update_user(user_id: int, req: UpdateUserRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    user = db.query(User).filter(User.id == user_id, User.organisation_id == current_user.organisation_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.email is not None:
        existing = db.query(User).filter(User.email == req.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = req.email
    if req.role is not None:
        if req.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {sorted(VALID_ROLES)}")
        user.role = req.role
    if req.restrict_to_assigned is not None:
        user.restrict_to_assigned = req.restrict_to_assigned
    if req.password:
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        user.hashed_password = hash_password(req.password)
    db.commit()
    db.refresh(user)
    return user


@router.put("/org-users/{user_id}/property-assignments")
def set_property_assignments(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace the full set of assigned properties for a user."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    user = db.query(User).filter(User.id == user_id, User.organisation_id == current_user.organisation_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from app.models.user_property_assignment import UserPropertyAssignment
    from app.models.property import Property
    property_ids = body.get("property_ids", [])
    # Validate all properties belong to this org
    valid = {p.id for p in db.query(Property).filter(
        Property.id.in_(property_ids),
        Property.organisation_id == current_user.organisation_id,
    ).all()}
    # Delete existing, insert new
    db.query(UserPropertyAssignment).filter(UserPropertyAssignment.user_id == user_id).delete()
    for pid in valid:
        db.add(UserPropertyAssignment(user_id=user_id, property_id=pid))
    db.commit()
    return {"ok": True, "assigned": len(valid)}


@router.delete("/org-users/{user_id}")
def remove_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")
    user = db.query(User).filter(User.id == user_id, User.organisation_id == current_user.organisation_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"ok": True}


class TestEmailRequest(BaseModel):
    to_email: EmailStr


@router.post("/test-email")
def send_test_email(req: TestEmailRequest, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    body = f"""
    <h2>Test email from PropAIrty</h2>
    <p>Hi,</p>
    <p>This is a test email to confirm that email notifications are configured correctly for your organisation.</p>
    <p>Tenant rent reminders will be sent automatically 3 days before, on the day, and after missed payments.</p>
    <a href="https://propairty.co.uk" style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin:8px 0;">
      Go to PropAIrty
    </a>
    """
    html = emails._base_template("PropAIrty — email test", body, "PropAIrty")
    ok = emails._send_email(req.to_email, "PropAIrty — email notifications are working", html)
    if ok:
        return {"ok": True, "message": f"Test email sent to {req.to_email}"}
    raise HTTPException(status_code=500, detail="Failed to send email — check SMTP settings")


import json as _json

DEFAULT_CHANNELS = ["email", "portal"]
DEFAULT_DAYS = [3, 1, 0, -1, -3, -7]

class ReminderSettingsRequest(BaseModel):
    channels: list
    days: list

@router.get("/reminder-settings")
def get_reminder_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organisation).get(current_user.organisation_id)
    return {
        "channels": _json.loads(org.reminder_channels) if org.reminder_channels else DEFAULT_CHANNELS,
        "days": _json.loads(org.reminder_days) if org.reminder_days else DEFAULT_DAYS,
    }

@router.put("/reminder-settings")
def save_reminder_settings(req: ReminderSettingsRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organisation).get(current_user.organisation_id)
    org.reminder_channels = _json.dumps(req.channels)
    org.reminder_days = _json.dumps(sorted(req.days, reverse=True))
    db.commit()
    return {"ok": True}


class BrandingUpdate(BaseModel):
    logo_url: str | None = None
    brand_color: str | None = None
    tagline: str | None = None
    address_text: str | None = None
    website_url: str | None = None

@router.get("/branding")
def get_branding(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organisation).get(current_user.organisation_id)
    return {
        "logo_url": org.logo_url,
        "brand_color": org.brand_color,
        "tagline": org.tagline,
        "address_text": org.address_text,
        "website_url": org.website_url,
        "slug": org.slug,
    }

@router.put("/branding")
def update_branding(req: BrandingUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organisation).get(current_user.organisation_id)
    if req.logo_url is not None: org.logo_url = req.logo_url or None
    if req.brand_color is not None: org.brand_color = req.brand_color or None
    if req.tagline is not None: org.tagline = req.tagline or None
    if req.address_text is not None: org.address_text = req.address_text or None
    if req.website_url is not None: org.website_url = req.website_url or None
    db.commit()
    return {"ok": True}
