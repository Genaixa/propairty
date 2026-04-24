from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

# ── Role hierarchy ────────────────────────────────────────────────────────────
# Ordered from most to least privileged.
ROLE_HIERARCHY = ["admin", "manager", "negotiator", "accounts", "read_only"]

# Roles that can write (create/update/delete)
WRITE_ROLES = {"admin", "manager", "negotiator", "accounts"}

# Finance-restricted roles (can only see Finance section)
FINANCE_ONLY_ROLES = {"accounts"}

# Roles that see everything (no property filtering even if restrict_to_assigned set)
UNRESTRICTED_ROLES = {"admin", "manager"}


def require_role(*allowed_roles: str):
    """FastAPI dependency: raise 403 if user's role is not in allowed_roles."""
    def _check(current_user: User = Depends(lambda token=Depends(oauth2_scheme), db=Depends(get_db): get_current_user(token, db))):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' not permitted. Required: {list(allowed_roles)}",
            )
        return current_user
    return _check


def require_write(current_user: User = Depends(lambda token=Depends(oauth2_scheme), db=Depends(get_db): get_current_user(token, db))):
    """Raise 403 if user is read_only."""
    if current_user.role == "read_only":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Read-only access — contact your admin.")
    return current_user


def get_accessible_property_ids(db: Session, user: User):
    """
    Returns a list of property IDs the user can access, or None meaning all.
    - admin/manager: always None (all)
    - Others with restrict_to_assigned=False: None (all)
    - Others with restrict_to_assigned=True: their assigned list only
    """
    if user.role in UNRESTRICTED_ROLES or not user.restrict_to_assigned:
        return None  # unrestricted
    from app.models.user_property_assignment import UserPropertyAssignment
    rows = db.query(UserPropertyAssignment).filter(UserPropertyAssignment.user_id == user.id).all()
    return [r.property_id for r in rows]


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        # Reject portal tokens (tenant/contractor) from agent endpoints
        if payload.get("type") in ("tenant", "contractor"):
            raise credentials_exception
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user
