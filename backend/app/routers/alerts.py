from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app import notifications

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertSettings(BaseModel):
    telegram_chat_id: Optional[str] = None


@router.post("/test")
def send_test_alert(current_user: User = Depends(get_current_user)):
    """Send a test Telegram message to verify the connection."""
    ok = notifications.send(
        f"✅ <b>PropAIrty connected!</b>\n\n"
        f"Hi! Your PropAIrty alerts are working.\n"
        f"You'll be notified here for:\n"
        f"• 💷 Overdue rent payments\n"
        f"• 📋 Expiring compliance certs\n"
        f"• 🔧 Urgent maintenance requests"
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send — check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID")
    return {"ok": True, "message": "Test alert sent"}


@router.post("/run-checks")
def run_checks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually trigger all daily checks now."""
    notifications.run_daily_checks(db)
    return {"ok": True, "message": "Checks run — alerts sent if issues found"}
