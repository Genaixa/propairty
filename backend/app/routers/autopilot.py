"""
AI Autopilot — configuration and activity log API.
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.autopilot import AutopilotConfig, AutopilotLog
from app.models.organisation import Organisation

router = APIRouter(prefix="/api/autopilot", tags=["autopilot"])


# ── Pydantic ──────────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    checks: Optional[Dict[str, Any]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_config(db: Session, org_id: int) -> AutopilotConfig:
    cfg = db.query(AutopilotConfig).filter(AutopilotConfig.organisation_id == org_id).first()
    if not cfg:
        from scripts.run_autopilot import DEFAULT_CONFIG
        cfg = AutopilotConfig(organisation_id=org_id, enabled=False, checks=DEFAULT_CONFIG)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _cfg_out(cfg: AutopilotConfig) -> dict:
    from scripts.run_autopilot import CHECKS_META, DEFAULT_CONFIG
    checks_out = {}
    for check_name, meta in CHECKS_META.items():
        saved = (cfg.checks or {}).get(check_name, {})
        can_auto = meta.get("can_auto_act", False)
        checks_out[check_name] = {
            "enabled": saved.get("enabled", True),
            "days": saved.get("days", meta["default_days"]),
            "label": meta["label"],
            "description": meta["description"],
            "unit": meta["unit"],
            "default_days": meta["default_days"],
            "can_auto_act": can_auto,
            "auto_act": saved.get("auto_act", True) if can_auto else False,
            "auto_act_description": meta.get("auto_act_description", ""),
        }
    return {
        "enabled": cfg.enabled,
        "checks": checks_out,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/config")
def get_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cfg = _get_or_create_config(db, current_user.organisation_id)
    return _cfg_out(cfg)


@router.put("/config")
def update_config(
    data: ConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cfg = _get_or_create_config(db, current_user.organisation_id)
    if data.enabled is not None:
        cfg.enabled = data.enabled
    if data.checks is not None:
        # Merge into existing — don't blow away unmentioned checks
        merged = dict(cfg.checks or {})
        merged.update(data.checks)
        cfg.checks = merged
    db.commit()
    db.refresh(cfg)
    return _cfg_out(cfg)


@router.get("/log")
def get_log(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entries = (
        db.query(AutopilotLog)
        .filter(AutopilotLog.organisation_id == current_user.organisation_id)
        .order_by(AutopilotLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "check_type": e.check_type,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "action": e.action,
            "recipient_label": e.recipient_label,
            "summary": e.summary,
            "message_sent": e.message_sent,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]


@router.post("/run")
def run_now(
    background_tasks: BackgroundTasks,
    dry_run: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a full autopilot run for this organisation immediately."""
    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()

    def _run():
        from app.database import SessionLocal
        from scripts.run_autopilot import run_for_org
        _db = SessionLocal()
        try:
            results = run_for_org(_db, org, dry_run=dry_run)
            return results
        finally:
            _db.close()

    if dry_run:
        # Dry run is synchronous so we can return the results
        from scripts.run_autopilot import run_for_org
        results = run_for_org(db, org, dry_run=True)
        return {"ok": True, "dry_run": True, "actions": results}
    else:
        background_tasks.add_task(_run)
        return {"ok": True, "dry_run": False, "message": "Autopilot run started in background"}


@router.get("/preview")
def preview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dry-run: show what autopilot would do right now without sending anything."""
    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    from scripts.run_autopilot import run_for_org
    results = run_for_org(db, org, dry_run=True)
    return {"actions": results, "count": len(results)}
