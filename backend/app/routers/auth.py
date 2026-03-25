from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import get_db
from app.models.user import User
from app.auth import verify_password, create_access_token, get_current_user
from app.schemas.auth import Token, UserOut
from app import password_reset as pr

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
@limiter.limit("5/minute")
def agent_forgot(request: Request, req: pr.ForgotRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email, User.is_active == True).first()
    return pr.request_reset(req.email, "agent", user.id if user else None, db)


@router.post("/reset-password")
def agent_reset(req: pr.ResetRequest, db: Session = Depends(get_db)):
    return pr.do_reset(req.token, req.new_password, "agent",
                       lambda uid, d: d.query(User).filter(User.id == uid).first(), db)
