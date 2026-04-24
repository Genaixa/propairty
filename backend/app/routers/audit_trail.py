from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, date, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _out(e: AuditLog) -> dict:
    return {
        "id": e.id,
        "user_name": e.user_name or "System",
        "action": e.action,
        "entity_type": e.entity_type,
        "entity_id": e.entity_id,
        "entity_name": e.entity_name,
        "detail": e.detail,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("")
def list_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    search: Optional[str] = None,
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(AuditLog).filter(
        AuditLog.organisation_id == current_user.organisation_id,
        AuditLog.created_at >= since,
    )
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(AuditLog.action == action)
    if search:
        term = f"%{search}%"
        q = q.filter(
            AuditLog.entity_name.ilike(term) |
            AuditLog.detail.ilike(term) |
            AuditLog.user_name.ilike(term)
        )
    entries = q.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [_out(e) for e in entries]


@router.get("/stats")
def audit_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(AuditLog.action, AuditLog.entity_type, func.count(AuditLog.id).label("n"))
        .filter(
            AuditLog.organisation_id == current_user.organisation_id,
            AuditLog.created_at >= since,
        )
        .group_by(AuditLog.action, AuditLog.entity_type)
        .all()
    )
    return [{"action": r.action, "entity_type": r.entity_type, "count": r.n} for r in rows]
