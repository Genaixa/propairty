"""
Audit trail helper for PropAIrty.
Call log_action() after any significant write operation.
"""
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    *,
    organisation_id: int,
    user_id: int | None = None,
    user_name: str | None = None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    entity_name: str | None = None,
    detail: str | None = None,
    ip_address: str | None = None,
):
    """Write a single audit log entry. Commit is the caller's responsibility."""
    entry = AuditLog(
        organisation_id=organisation_id,
        user_id=user_id,
        user_name=user_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        detail=detail,
        ip_address=ip_address,
    )
    db.add(entry)
