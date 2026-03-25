"""
Shared password reset helpers used by all four portal routers.
Each portal passes its own user_type so tokens are strictly isolated.
"""
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.password_reset import PasswordResetToken
from app.auth import hash_password
from app import emails
from app.config import settings


class ForgotRequest(BaseModel):
    email: str


class ResetRequest(BaseModel):
    token: str
    new_password: str


def _portal_label(user_type: str) -> str:
    return {
        "agent": "PropAIrty",
        "tenant": "PropAIrty Tenant Portal",
        "landlord": "PropAIrty Landlord Portal",
        "contractor": "PropAIrty Contractor Portal",
    }.get(user_type, "PropAIrty")


def _reset_path(user_type: str) -> str:
    return {
        "agent": "/reset-password",
        "tenant": "/tenant/reset-password",
        "landlord": "/landlord/reset-password",
        "contractor": "/contractor/reset-password",
    }.get(user_type, "/reset-password")


def request_reset(email: str, user_type: str, user_id: int | None, db: Session):
    """
    Create a reset token and send the email.
    Always returns 200 even if email not found (prevents user enumeration).
    """
    if user_id is None:
        return {"detail": "If that email is registered you will receive a reset link shortly."}

    # Invalidate any existing unused tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_type == user_type,
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.used == False,
    ).update({"used": True})

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(PasswordResetToken(
        token=token,
        user_type=user_type,
        user_id=user_id,
        expires_at=expires,
    ))
    db.commit()

    reset_url = f"{settings.app_base_url}{_reset_path(user_type)}?token={token}"
    emails.send_password_reset(email, reset_url, _portal_label(user_type))
    return {"detail": "If that email is registered you will receive a reset link shortly."}


def do_reset(token_str: str, new_password: str, user_type: str, get_user, db: Session):
    """
    Validate token (must match user_type), set new password.
    get_user: callable(user_id, db) -> user model instance or None
    """
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token_str,
        PasswordResetToken.user_type == user_type,   # portal isolation enforced here
        PasswordResetToken.used == False,
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset link has expired — please request a new one")

    user = get_user(record.user_id, db)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.hashed_password = hash_password(new_password)
    record.used = True
    db.commit()
    return {"detail": "Password updated successfully"}
