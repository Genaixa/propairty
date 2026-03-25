from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.compliance import ComplianceCertificate, CERT_TYPES
from app.models.property import Property

router = APIRouter(prefix="/api/compliance", tags=["compliance"])

EXPIRY_WARNING_DAYS = 60


def _status(expiry: date) -> str:
    today = date.today()
    if expiry < today:
        return "expired"
    if expiry <= today + timedelta(days=EXPIRY_WARNING_DAYS):
        return "expiring_soon"
    return "valid"


def _enrich(cert: ComplianceCertificate) -> dict:
    return {
        "id": cert.id,
        "property_id": cert.property_id,
        "property_name": cert.property.name if cert.property else "Unknown",
        "cert_type": cert.cert_type,
        "cert_label": CERT_TYPES.get(cert.cert_type, {}).get("label", cert.cert_type),
        "issue_date": str(cert.issue_date),
        "expiry_date": str(cert.expiry_date),
        "days_until_expiry": (cert.expiry_date - date.today()).days,
        "status": _status(cert.expiry_date),
        "reference": cert.reference,
        "contractor": cert.contractor,
        "notes": cert.notes,
    }


class CertCreate(BaseModel):
    property_id: int
    cert_type: str
    issue_date: date
    expiry_date: date
    reference: Optional[str] = None
    contractor: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
def list_certificates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    certs = db.query(ComplianceCertificate).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).order_by(ComplianceCertificate.expiry_date).all()
    return [_enrich(c) for c in certs]


@router.get("/summary")
def compliance_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Per-property compliance status across all cert types."""
    properties = db.query(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()

    result = []
    for prop in properties:
        certs = db.query(ComplianceCertificate).filter(
            ComplianceCertificate.property_id == prop.id
        ).all()

        cert_map = {}
        for c in certs:
            # Keep the most recent cert per type
            if c.cert_type not in cert_map or c.expiry_date > cert_map[c.cert_type].expiry_date:
                cert_map[c.cert_type] = c

        statuses = {}
        for ctype, meta in CERT_TYPES.items():
            if ctype in cert_map:
                statuses[ctype] = {
                    "label": meta["label"],
                    "status": _status(cert_map[ctype].expiry_date),
                    "expiry_date": str(cert_map[ctype].expiry_date),
                    "days_until_expiry": (cert_map[ctype].expiry_date - date.today()).days,
                    "cert_id": cert_map[ctype].id,
                }
            else:
                statuses[ctype] = {
                    "label": meta["label"],
                    "status": "missing",
                    "expiry_date": None,
                    "days_until_expiry": None,
                    "cert_id": None,
                }

        overall = "valid"
        if any(v["status"] == "expired" for v in statuses.values()):
            overall = "expired"
        elif any(v["status"] in ("expiring_soon", "missing") for v in statuses.values()):
            overall = "attention"

        result.append({
            "property_id": prop.id,
            "property_name": prop.name,
            "property_type": prop.property_type,
            "overall_status": overall,
            "certificates": statuses,
        })

    return result


@router.get("/alerts")
def compliance_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return all expired/expiring_soon certs plus missing certs for active properties."""
    certs = db.query(ComplianceCertificate).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()

    alerts = []
    for c in certs:
        s = _status(c.expiry_date)
        if s in ("expired", "expiring_soon"):
            alerts.append({**_enrich(c), "alert_type": s})

    return sorted(alerts, key=lambda x: x["expiry_date"])


@router.post("")
def create_certificate(data: CertCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).filter(
        Property.id == data.property_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    cert = ComplianceCertificate(**data.model_dump())
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return _enrich(cert)


@router.delete("/{cert_id}")
def delete_certificate(cert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cert = db.query(ComplianceCertificate).join(Property).filter(
        ComplianceCertificate.id == cert_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    db.delete(cert)
    db.commit()
    return {"ok": True}
