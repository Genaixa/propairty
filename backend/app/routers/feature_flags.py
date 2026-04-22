from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Dict

from app.auth import get_current_user
from app.models.user import User
from app.models.feature_flag import OrgFeatureFlag
from app.database import get_db
from app import feature_flags as ff

router = APIRouter(prefix="/api/settings", tags=["features"])


@router.get("/features")
def get_features(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all feature flags for the current user's org, grouped by portal."""
    flags = ff.get_org_features(db, current_user.organisation_id)

    groups: dict = {}
    for key, meta in ff.FEATURE_REGISTRY.items():
        g = meta["group_label"]
        if g not in groups:
            groups[g] = []
        groups[g].append({
            "key": key,
            "label": meta["label"],
            "enabled": flags[key],
            "premium_only": meta["premium_only"],
        })
    return {"groups": groups}


class FeaturesUpdate(BaseModel):
    flags: Dict[str, bool]


@router.post("/features")
def save_features(
    body: FeaturesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")

    saved = 0
    for key, enabled in body.flags.items():
        if key not in ff.FEATURE_REGISTRY:
            continue
        row = (
            db.query(OrgFeatureFlag)
            .filter_by(organisation_id=current_user.organisation_id, flag_key=key)
            .first()
        )
        if row:
            row.enabled = enabled
        else:
            db.add(OrgFeatureFlag(
                organisation_id=current_user.organisation_id,
                flag_key=key,
                enabled=enabled,
            ))
        saved += 1

    db.commit()
    return {"message": f"Saved {saved} feature flag(s)."}


# ── Custom domain ─────────────────────────────────────────────────────────────

from app.models.organisation import Organisation as _Org
from pydantic import BaseModel as _BM

class _DomainReq(_BM):
    custom_domain: str


@router.get("/custom-domain")
def get_custom_domain(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(_Org).filter_by(id=current_user.organisation_id).first()
    return {"custom_domain": org.custom_domain or ""}


@router.put("/custom-domain")
def set_custom_domain(req: _DomainReq, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    domain = req.custom_domain.strip().lower().lstrip("https://").lstrip("http://").rstrip("/")
    if domain:
        # Check no other org owns this domain
        clash = db.query(_Org).filter(_Org.custom_domain == domain, _Org.id != current_user.organisation_id).first()
        if clash:
            raise HTTPException(status_code=409, detail="Domain already in use by another organisation.")
    org = db.query(_Org).filter_by(id=current_user.organisation_id).first()
    org.custom_domain = domain or None
    db.commit()
    return {"custom_domain": org.custom_domain or ""}
