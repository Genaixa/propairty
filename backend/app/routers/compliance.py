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
from app.models.unit import Unit

router = APIRouter(prefix="/api/compliance", tags=["compliance"])

EXPIRY_WARNING_DAYS = 90


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
        "unit_id": cert.unit_id,
        "unit_name": cert.unit.name if cert.unit else None,
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
    unit_id: Optional[int] = None
    cert_type: str
    issue_date: date
    expiry_date: date
    reference: Optional[str] = None
    contractor: Optional[str] = None
    notes: Optional[str] = None


class CertUpdate(BaseModel):
    unit_id: Optional[int] = None
    cert_type: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    reference: Optional[str] = None
    contractor: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
def list_certificates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    certs = db.query(ComplianceCertificate).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).order_by(ComplianceCertificate.expiry_date).all()
    return [_enrich(c) for c in certs]


def _build_cert_map(certs):
    """Return the best (latest-expiry) cert per cert_type from a list."""
    m = {}
    for c in certs:
        if c.cert_type not in m or c.expiry_date > m[c.cert_type].expiry_date:
            m[c.cert_type] = c
    return m


def _statuses_from_map(cert_map):
    statuses = {}
    today = date.today()
    for ctype, meta in CERT_TYPES.items():
        if ctype in cert_map:
            c = cert_map[ctype]
            statuses[ctype] = {
                "label": meta["label"],
                "status": _status(c.expiry_date),
                "expiry_date": str(c.expiry_date),
                "days_until_expiry": (c.expiry_date - today).days,
                "cert_id": c.id,
            }
        else:
            statuses[ctype] = {
                "label": meta["label"],
                "status": "missing",
                "expiry_date": None,
                "days_until_expiry": None,
                "cert_id": None,
            }
    return statuses


def _overall(statuses):
    vals = {v["status"] for v in statuses.values()}
    if "expired" in vals:
        return "expired"
    if "expiring_soon" in vals:
        return "expiring_soon"
    if "missing" in vals:
        return "incomplete"
    return "valid"


@router.get("/summary")
def compliance_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Per-property compliance status across all cert types. Multi-unit properties return per-unit rows."""
    properties = db.query(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()

    result = []
    for prop in properties:
        certs = db.query(ComplianceCertificate).filter(
            ComplianceCertificate.property_id == prop.id
        ).all()
        prop_level = [c for c in certs if c.unit_id is None]
        units = sorted(prop.units, key=lambda u: u.name or "")

        if len(units) > 1:
            unit_rows = []
            for unit in units:
                unit_certs = [c for c in certs if c.unit_id == unit.id]
                # property-level certs apply to all units (fallback)
                merged = _build_cert_map(prop_level)
                merged.update(_build_cert_map(unit_certs))
                unit_statuses = _statuses_from_map(merged)
                unit_rows.append({
                    "unit_id": unit.id,
                    "unit_name": unit.name,
                    "certificates": unit_statuses,
                    "overall_status": _overall(unit_statuses),
                })
            # Property-level overall: aggregate across all units
            all_unit_statuses = {}
            for ctype in CERT_TYPES:
                unit_vals = {ur["certificates"][ctype]["status"] for ur in unit_rows}
                if "expired" in unit_vals:
                    worst = "expired"
                elif "expiring_soon" in unit_vals:
                    worst = "expiring_soon"
                elif "missing" in unit_vals:
                    worst = "missing"
                else:
                    worst = "valid"
                all_unit_statuses[ctype] = {"status": worst}
            result.append({
                "property_id": prop.id,
                "property_name": prop.name,
                "property_type": prop.property_type,
                "overall_status": _overall(all_unit_statuses),
                "is_multi_unit": True,
                "units": unit_rows,
                "certificates": _statuses_from_map(_build_cert_map(certs)),
            })
        else:
            cert_map = _build_cert_map(certs)
            statuses = _statuses_from_map(cert_map)
            result.append({
                "property_id": prop.id,
                "property_name": prop.name,
                "property_type": prop.property_type,
                "overall_status": _overall(statuses),
                "is_multi_unit": False,
                "units": [],
                "certificates": statuses,
            })

    return result


@router.get("/alerts")
def compliance_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    certs = db.query(ComplianceCertificate).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()

    alerts = []
    for c in certs:
        s = _status(c.expiry_date)
        if s in ("expired", "expiring_soon"):
            alerts.append({**_enrich(c), "alert_type": s})

    return sorted(alerts, key=lambda x: x["expiry_date"])


@router.get("/units-for-property/{property_id}")
def units_for_property(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return [{"id": u.id, "name": u.name} for u in sorted(prop.units, key=lambda u: u.name or '')]


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


@router.put("/{cert_id}")
def update_certificate(cert_id: int, data: CertUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cert = db.query(ComplianceCertificate).join(Property).filter(
        ComplianceCertificate.id == cert_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cert, k, v)
    db.commit()
    db.refresh(cert)
    return _enrich(cert)


@router.post("/seed")
def seed_compliance(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type, timedelta
    property_id = data.get("property_id")
    start_date_str = data.get("start_date")

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
