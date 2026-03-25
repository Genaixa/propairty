import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.auth import hash_password, get_current_user, create_access_token
from app.models.organisation import Organisation
from app.models.user import User
from app.schemas.auth import Token, UserOut
from app import notifications, emails

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
    org = Organisation(name=req.org_name, slug=slug)
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


@router.get("/org-users", response_model=list[UserOut])
def list_org_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(User).filter(User.organisation_id == current_user.organisation_id).all()


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
