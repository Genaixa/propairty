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


@router.post("/seed")
def seed_compliance(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Auto-create placeholder compliance records when a new tenancy is set up.
    Creates Gas Safety, EICR, EPC and Deposit Protection entries as 'due now'
    so they appear in the compliance dashboard for the agent to action.
    Skips any cert type that already has a record for this property.
    """
    from datetime import date as date_type, timedelta
    property_id = data.get("property_id")
    start_date_str = data.get("start_date")  # YYYY-MM-DD

    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    try:
        start_date = date_type.fromisoformat(start_date_str)
    except Exception:
        start_date = date_type.today()

    today = date_type.today()
    deadline_30 = start_date + timedelta(days=30)

    # Certs to seed for every new tenancy
    # Gas/EICR/EPC expire yesterday → immediately show as Expired, forcing agent to upload real certs
    # Deposit protection expires 30 days after tenancy start → shows as Expiring Soon with countdown
    to_seed = [
        {
            "cert_type": "gas_safety",
            "issue_date": today - timedelta(days=1),
            "expiry_date": today - timedelta(days=1),
            "notes": "Auto-created from lease import. Please upload the current Gas Safety Certificate.",
        },
        {
            "cert_type": "eicr",
            "issue_date": today - timedelta(days=1),
            "expiry_date": today - timedelta(days=1),
            "notes": "Auto-created from lease import. Please upload the current EICR.",
        },
        {
            "cert_type": "epc",
            "issue_date": today - timedelta(days=1),
            "expiry_date": today - timedelta(days=1),
            "notes": "Auto-created from lease import. Please upload the current EPC.",
        },
        {
            "cert_type": "deposit_protection",
            "issue_date": start_date,
            "expiry_date": deadline_30,
            "notes": "Auto-created from lease import. Confirm deposit is registered with TDS/DPS/mydeposits within 30 days of tenancy start.",
        },
    ]

    created = []
    for item in to_seed:
        # Skip if a record of this type already exists for the property
        existing = db.query(ComplianceCertificate).filter(
            ComplianceCertificate.property_id == property_id,
            ComplianceCertificate.cert_type == item["cert_type"],
        ).first()
        if existing:
            continue
        cert = ComplianceCertificate(property_id=property_id, **item)
        db.add(cert)
        db.flush()
        created.append(cert.cert_type)

    db.commit()
    return {"seeded": created}


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
