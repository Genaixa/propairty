from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime, timedelta

from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token
from app.models.landlord import Landlord
from app.models.property import Property
from app.models.unit import Unit
from app.models.lease import Lease
from app.models.payment import RentPayment
from app.models.maintenance import MaintenanceRequest
from app.models.compliance import ComplianceCertificate, CERT_TYPES
from app.models.user import User
from app.models.organisation import Organisation
from app.schemas.auth import Token
from app.config import settings
from app import docgen
from app import password_reset as pr
from app import emails as _emails
from jose import JWTError, jwt
from fastapi.responses import Response

router = APIRouter(prefix="/api/landlord", tags=["landlord"])
limiter = Limiter(key_func=get_remote_address)

landlord_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/landlord/token")


def get_current_landlord(token: str = Depends(landlord_oauth2), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "landlord":
            raise ValueError("not a landlord token")
        landlord_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    landlord = db.query(Landlord).filter(Landlord.id == landlord_id, Landlord.is_active == True).first()
    if not landlord:
        raise HTTPException(status_code=401, detail="Landlord not found")
    return landlord


# --- Auth ---

@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
def landlord_login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    landlord = db.query(Landlord).filter(Landlord.email == form_data.username).first()
    if not landlord or not verify_password(form_data.password, landlord.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token({"sub": str(landlord.id), "type": "landlord"})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/forgot-password")
@limiter.limit("5/minute")
def landlord_forgot(request: Request, req: pr.ForgotRequest, db: Session = Depends(get_db)):
    landlord = db.query(Landlord).filter(Landlord.email == req.email, Landlord.is_active == True).first()
    return pr.request_reset(req.email, "landlord", landlord.id if landlord else None, db)


@router.post("/reset-password")
def landlord_reset(req: pr.ResetRequest, db: Session = Depends(get_db)):
    return pr.do_reset(req.token, req.new_password, "landlord",
                       lambda uid, d: d.query(Landlord).filter(Landlord.id == uid).first(), db)


@router.get("/me")
def landlord_me(landlord: Landlord = Depends(get_current_landlord)):
    return {
        "id": landlord.id,
        "full_name": landlord.full_name,
        "email": landlord.email,
        "phone": landlord.phone,
    }


class LandlordProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class LandlordPasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.patch("/me")
def update_landlord_me(data: LandlordProfileUpdate, landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    if data.full_name is not None:
        landlord.full_name = data.full_name.strip()
    if data.phone is not None:
        landlord.phone = data.phone.strip()
    db.commit()
    return {"id": landlord.id, "full_name": landlord.full_name, "email": landlord.email, "phone": landlord.phone}


@router.post("/me/change-password")
def landlord_change_password(data: LandlordPasswordChange, landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    from app.auth import verify_password, hash_password
    if not verify_password(data.current_password, landlord.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    landlord.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


# --- CRUD for agents to manage landlords ---

class LandlordCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: Optional[str] = None
    phone: Optional[str] = None


class LandlordOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    portal_enabled: bool = False

    class Config:
        from_attributes = True


class EnablePortalRequest(BaseModel):
    password: str


def get_agent(token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/token")), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/landlords", response_model=LandlordOut)
def create_landlord(req: LandlordCreate, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    if db.query(Landlord).filter(Landlord.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    landlord = Landlord(
        organisation_id=agent.organisation_id,
        full_name=req.full_name,
        email=req.email,
        hashed_password=hash_password(req.password) if req.password and len(req.password) >= 8 else None,
        portal_enabled=bool(req.password and len(req.password) >= 8),
        phone=req.phone,
    )
    db.add(landlord)
    db.commit()
    db.refresh(landlord)
    return landlord


@router.get("/landlords")
def list_landlords(db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    landlords = db.query(Landlord).filter(Landlord.organisation_id == agent.organisation_id).all()
    result = []
    for ll in landlords:
        props = db.query(Property).filter(Property.landlord_id == ll.id, Property.organisation_id == agent.organisation_id).all()
        result.append({
            "id": ll.id,
            "full_name": ll.full_name,
            "email": ll.email,
            "phone": ll.phone,
            "portal_enabled": ll.portal_enabled,
            "avatar_url": ll.avatar_url,
            "properties": [{"id": p.id, "name": p.name, "address": f"{p.address_line1}, {p.city}"} for p in props],
        })
    return result


@router.get("/landlords/{landlord_id}")
def get_landlord(landlord_id: int, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    ll = db.query(Landlord).filter(Landlord.id == landlord_id, Landlord.organisation_id == agent.organisation_id).first()
    if not ll:
        raise HTTPException(status_code=404, detail="Landlord not found")
    props = db.query(Property).filter(Property.landlord_id == ll.id, Property.organisation_id == agent.organisation_id).all()
    return {
        "id": ll.id, "full_name": ll.full_name, "email": ll.email, "phone": ll.phone,
        "portal_enabled": ll.portal_enabled, "avatar_url": ll.avatar_url, "notes": ll.notes,
        "address_line1": ll.address_line1, "address_line2": ll.address_line2,
        "city": ll.city, "postcode": ll.postcode,
        "company_name": ll.company_name, "company_number": ll.company_number, "vat_number": ll.vat_number,
        "bank_name": ll.bank_name, "account_name": ll.account_name,
        "sort_code": ll.sort_code, "account_number": ll.account_number,
        "management_fee_pct": ll.management_fee_pct,
        "properties": [{"id": p.id, "name": p.name, "address": f"{p.address_line1}, {p.city}"} for p in props],
    }


class LandlordUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postcode: Optional[str] = None
    company_name: Optional[str] = None
    company_number: Optional[str] = None
    vat_number: Optional[str] = None
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    sort_code: Optional[str] = None
    account_number: Optional[str] = None
    notes: Optional[str] = None
    management_fee_pct: Optional[float] = None


@router.put("/landlords/{landlord_id}")
def update_landlord(landlord_id: int, req: LandlordUpdate, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    ll = db.query(Landlord).filter(Landlord.id == landlord_id, Landlord.organisation_id == agent.organisation_id).first()
    if not ll:
        raise HTTPException(status_code=404, detail="Landlord not found")
    data = req.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(ll, k, v)
    db.commit()
    return {"ok": True}


@router.put("/landlords/{landlord_id}/assign-property/{property_id}")
def assign_property(landlord_id: int, property_id: int, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    prop = db.query(Property).filter(Property.id == property_id, Property.organisation_id == agent.organisation_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    landlord = db.query(Landlord).filter(Landlord.id == landlord_id, Landlord.organisation_id == agent.organisation_id).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    prop.landlord_id = landlord_id
    db.commit()
    return {"ok": True}


@router.put("/landlords/{landlord_id}/unassign-property/{property_id}")
def unassign_property(landlord_id: int, property_id: int, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    prop = db.query(Property).filter(Property.id == property_id, Property.organisation_id == agent.organisation_id, Property.landlord_id == landlord_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    prop.landlord_id = None
    db.commit()
    return {"ok": True}


@router.post("/landlords/{landlord_id}/enable-portal")
def enable_landlord_portal(landlord_id: int, req: EnablePortalRequest, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    landlord = db.query(Landlord).filter(Landlord.id == landlord_id, Landlord.organisation_id == agent.organisation_id).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    landlord.hashed_password = hash_password(req.password)
    landlord.portal_enabled = True
    db.commit()
    return {"ok": True}


@router.post("/landlords/{landlord_id}/disable-portal")
def disable_landlord_portal(landlord_id: int, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    landlord = db.query(Landlord).filter(Landlord.id == landlord_id, Landlord.organisation_id == agent.organisation_id).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    landlord.portal_enabled = False
    landlord.hashed_password = None
    db.commit()
    return {"ok": True}


@router.delete("/landlords/{landlord_id}")
def delete_landlord(landlord_id: int, db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    landlord = db.query(Landlord).filter(Landlord.id == landlord_id, Landlord.organisation_id == agent.organisation_id).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    # Unassign properties first
    db.query(Property).filter(Property.landlord_id == landlord_id).update({"landlord_id": None})
    db.delete(landlord)
    db.commit()
    return {"ok": True}


# --- Landlord portal views ---

@router.get("/portal/properties")
def portal_properties(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    props = db.query(Property).filter(Property.landlord_id == landlord.id).all()
    result = []
    for p in props:
        units = db.query(Unit).filter(Unit.property_id == p.id).all()
        unit_data = []
        for u in units:
            lease = db.query(Lease).filter(Lease.unit_id == u.id, Lease.status == "active").first()
            unit_data.append({
                "id": u.id,
                "name": u.name,
                "rent_amount": u.monthly_rent,
                "status": u.status,
                "tenant_name": lease.tenant.full_name if lease and lease.tenant else None,
                "lease_end": lease.end_date.isoformat() if lease and lease.end_date else None,
            })
        result.append({
            "id": p.id,
            "name": p.name,
            "address": f"{p.address_line1}, {p.city}, {p.postcode}",
            "property_type": p.property_type,
            "units": unit_data,
        })
    return result


@router.get("/portal/financials")
def portal_financials(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    if not prop_ids:
        return {"total_rent": 0, "collected": 0, "arrears": 0, "payments": []}

    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    lease_ids = [l.id for l in db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all()]

    payments = db.query(RentPayment).filter(RentPayment.lease_id.in_(lease_ids)).order_by(RentPayment.due_date.desc()).limit(50).all()

    total = sum(p.amount_due for p in payments if p.due_date and p.due_date >= date.today().replace(day=1))
    collected = sum(p.amount_paid or 0 for p in payments if p.status == "paid")
    arrears = sum(p.amount_due - (p.amount_paid or 0) for p in payments if p.status == "overdue")

    # Build a lookup: lease_id → (unit, property, tenant)
    lease_meta = {}
    for lease in db.query(Lease).filter(Lease.id.in_([p.lease_id for p in payments])).all():
        unit = db.query(Unit).filter(Unit.id == lease.unit_id).first()
        prop = db.query(Property).filter(Property.id == unit.property_id).first() if unit else None
        lease_meta[lease.id] = {
            "property_name": prop.name if prop else "—",
            "unit_name": unit.name if unit else "—",
            "tenant_name": lease.tenant.full_name if lease.tenant else "—",
        }

    return {
        "total_rent": total,
        "collected": collected,
        "arrears": arrears,
        "payments": [
            {
                "id": p.id,
                "due_date": p.due_date.isoformat() if p.due_date else None,
                "amount_due": p.amount_due,
                "amount_paid": p.amount_paid,
                "status": p.status,
                **lease_meta.get(p.lease_id, {"property_name": "—", "unit_name": "—", "tenant_name": "—"}),
            }
            for p in payments
        ],
    }


@router.get("/portal/compliance")
def portal_compliance(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    if not prop_ids:
        return []
    certs = db.query(ComplianceCertificate).filter(ComplianceCertificate.property_id.in_(prop_ids)).all()
    today = date.today()
    result = []
    for c in certs:
        days = (c.expiry_date - today).days if c.expiry_date else None
        if days is None:
            status = "unknown"
        elif days < 0:
            status = "expired"
        elif days <= 30:
            status = "expiring_soon"
        else:
            status = "valid"
        result.append({
            "id": c.id,
            "property_id": c.property_id,
            "cert_type": c.cert_type,
            "label": CERT_TYPES.get(c.cert_type, {}).get("label", c.cert_type),
            "issue_date": c.issue_date.isoformat() if c.issue_date else None,
            "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
            "status": status,
            "days_remaining": days,
        })
    return result


@router.get("/portal/report")
def portal_report(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    from datetime import date as dt
    import calendar

    today = dt.today()
    report_month = today.strftime("%B %Y")
    month_start = today.replace(day=1)
    month_end = today.replace(day=calendar.monthrange(today.year, today.month)[1])

    props = db.query(Property).filter(Property.landlord_id == landlord.id).all()
    org = db.query(Organisation).filter(Organisation.id == landlord.organisation_id).first()

    properties_data = []
    compliance_items = []
    renewals = []

    for p in props:
        units = db.query(Unit).filter(Unit.property_id == p.id).all()
        unit_data = []
        for u in units:
            lease = db.query(Lease).filter(Lease.unit_id == u.id, Lease.status == "active").first()
            payment = None
            if lease:
                payment = db.query(RentPayment).filter(
                    RentPayment.lease_id == lease.id,
                    RentPayment.due_date >= month_start,
                    RentPayment.due_date <= month_end,
                ).first()
            status = "vacant"
            if lease:
                status = payment.status if payment else "pending"
            unit_data.append({
                "name": u.name,
                "tenant_name": lease.tenant.full_name if lease and lease.tenant else None,
                "expected": payment.amount_due if payment else (lease.monthly_rent if lease else 0),
                "collected": payment.amount_paid or 0 if payment and payment.status == "paid" else 0,
                "status": status,
            })

        # Compliance
        certs = db.query(ComplianceCertificate).filter(ComplianceCertificate.property_id == p.id).all()
        for c in certs:
            days = (c.expiry_date - today).days if c.expiry_date else None
            status = "unknown" if days is None else ("expired" if days < 0 else ("expiring_soon" if days <= 60 else "valid"))
            compliance_items.append({
                "property_name": p.name,
                "label": CERT_TYPES.get(c.cert_type, {}).get("label", c.cert_type),
                "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
                "status": status,
            })

        # Renewals
        for u in units:
            lease = db.query(Lease).filter(Lease.unit_id == u.id, Lease.status == "active", Lease.end_date != None).first()
            if lease and lease.end_date:
                days_remaining = (lease.end_date - today).days
                if days_remaining <= 90:
                    renewals.append({
                        "tenant_name": lease.tenant.full_name if lease.tenant else "Unknown",
                        "property_name": p.name,
                        "unit_name": u.name,
                        "end_date": lease.end_date.isoformat(),
                        "days_remaining": days_remaining,
                    })

        properties_data.append({
            "name": p.name,
            "address": f"{p.address_line1}, {p.city}, {p.postcode}",
            "units": unit_data,
        })

    pdf = docgen.generate_financial_report(landlord, properties_data, compliance_items, renewals, report_month, org.name if org else "PropAIrty")
    filename = f"PropAIrty-Report-{landlord.full_name.replace(' ','-')}-{today.strftime('%Y-%m')}.pdf"
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/portal/maintenance")
def portal_maintenance(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    if not prop_ids:
        return []
    jobs = db.query(MaintenanceRequest).filter(MaintenanceRequest.property_id.in_(prop_ids)).order_by(MaintenanceRequest.created_at.desc()).limit(50).all()
    return [
        {
            "id": j.id,
            "title": j.title,
            "description": j.description,
            "priority": j.priority,
            "status": j.status,
            "property_id": j.property_id,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "actual_cost": j.actual_cost,
            "invoice_ref": j.invoice_ref,
            "assigned_to": j.assigned_to,
        }
        for j in jobs
    ]


@router.get("/portal/arrears")
def portal_arrears(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    """Per-tenant arrears breakdown across all landlord properties."""
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    if not prop_ids:
        return []
    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    leases = db.query(Lease).filter(Lease.unit_id.in_(unit_ids), Lease.status == "active").all()

    result = []
    today = date.today()
    for lease in leases:
        overdue_payments = db.query(RentPayment).filter(
            RentPayment.lease_id == lease.id,
            RentPayment.status.in_(["overdue", "partial"]),
        ).order_by(RentPayment.due_date.asc()).all()
        if not overdue_payments:
            continue
        total_owed = sum(p.amount_due - (p.amount_paid or 0) for p in overdue_payments)
        oldest = overdue_payments[0]
        days_overdue = (today - oldest.due_date).days if oldest.due_date else 0
        unit = lease.unit
        prop = unit.property if unit else None
        tenant = lease.tenant
        result.append({
            "tenant_name": tenant.full_name if tenant else "Unknown",
            "property": prop.name if prop else "—",
            "unit": unit.name if unit else "—",
            "total_owed": total_owed,
            "oldest_due_date": oldest.due_date.isoformat() if oldest.due_date else None,
            "days_overdue": days_overdue,
            "payments_overdue": len(overdue_payments),
        })
    result.sort(key=lambda x: x["days_overdue"], reverse=True)
    return result


@router.get("/portal/documents")
def portal_documents(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    """Documents attached to landlord's properties and their leases/units, including e-signed docs."""
    from app.models.upload import UploadedFile
    from app.models.signing_request import SigningRequest
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    if not prop_ids:
        return []
    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    lease_ids = [l.id for l in db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all()]

    # Collect files by entity_type + entity_id matching landlord's portfolio
    files = []
    for entity_type, ids in [("property", prop_ids), ("lease", lease_ids)]:
        if ids:
            files += db.query(UploadedFile).filter(
                UploadedFile.entity_type == entity_type,
                UploadedFile.entity_id.in_(ids),
            ).order_by(UploadedFile.created_at.desc()).all()

    # Build property/unit name lookup
    prop_map = {p.id: p.name for p in db.query(Property).filter(Property.id.in_(prop_ids)).all()}
    unit_map = {u.id: (u.name, prop_map.get(u.property_id, "—")) for u in db.query(Unit).filter(Unit.id.in_(unit_ids)).all()}
    lease_context = {}
    for lease in db.query(Lease).filter(Lease.id.in_(lease_ids)).all():
        uname, pname = unit_map.get(lease.unit_id, ("—", "—"))
        tenant_name = lease.tenant.full_name if lease.tenant else None
        lease_context[lease.id] = {"property": pname, "unit": uname, "tenant": tenant_name}

    def context_for(f):
        if f.entity_type == "property":
            return {"property": prop_map.get(f.entity_id, "—"), "unit": None, "tenant": None}
        if f.entity_type == "lease":
            return lease_context.get(f.entity_id, {"property": "—", "unit": None, "tenant": None})
        return {"property": "—", "unit": None, "tenant": None}

    result = [
        {
            "id": f"upload-{f.id}",
            "original_name": f.original_name,
            "category": f.category,
            "description": f.description,
            "entity_type": f.entity_type,
            "file_size": f.file_size,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "source": "upload",
            **context_for(f),
        }
        for f in files
        if f.category != "photo"
    ]

    # Add e-signed documents for this landlord's leases
    if lease_ids:
        signed_docs = db.query(SigningRequest).filter(
            SigningRequest.lease_id.in_(lease_ids),
            SigningRequest.status == "signed",
            SigningRequest.signed_pdf_path.isnot(None),
        ).order_by(SigningRequest.signed_at.desc()).all()

        for s in signed_docs:
            ctx = lease_context.get(s.lease_id, {"property": "—", "unit": None, "tenant": None})
            result.append({
                "id": f"signed-{s.id}",
                "original_name": f"{s.doc_label} (Signed).pdf",
                "category": "signed_document",
                "description": f"Signed by {s.signer_name} on {s.signed_at.strftime('%d %b %Y') if s.signed_at else '—'}",
                "entity_type": "signing_request",
                "file_size": None,
                "created_at": s.signed_at.isoformat() if s.signed_at else None,
                "source": "esign",
                "token": s.token,
                "doc_label": s.doc_label,
                "signer_name": s.signer_name,
                "signed_at": s.signed_at.isoformat() if s.signed_at else None,
                "download_url": f"/api/signing/{s.token}/download",
                **ctx,
            })

    result.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return result


@router.get("/portal/documents/{doc_id}/download")
def portal_download_document(doc_id: int, landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    """Serve a document file — verifies it belongs to this landlord's portfolio."""
    from app.models.upload import UploadedFile
    from fastapi.responses import FileResponse
    from pathlib import Path
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    lease_ids = [l.id for l in db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all()]
    allowed = {("property", pid) for pid in prop_ids} | {("lease", lid) for lid in lease_ids}
    f = db.query(UploadedFile).filter(UploadedFile.id == doc_id).first()
    if not f or (f.entity_type, f.entity_id) not in allowed:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path("/root/propairty/uploads") / f.filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(path, filename=f.original_name, media_type=f.mime_type or "application/octet-stream")


@router.get("/portal/renewals")
def portal_renewals(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    """Leases expiring within 90 days across landlord's properties."""
    from app.models.renewal import LeaseRenewal
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    if not prop_ids:
        return []
    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    today = date.today()
    cutoff = today + timedelta(days=90)
    leases = db.query(Lease).filter(
        Lease.unit_id.in_(unit_ids),
        Lease.status == "active",
        Lease.end_date != None,
        Lease.end_date <= cutoff,
    ).order_by(Lease.end_date.asc()).all()

    result = []
    for lease in leases:
        unit = lease.unit
        prop = unit.property if unit else None
        tenant = lease.tenant
        days_remaining = (lease.end_date - today).days
        renewal = db.query(LeaseRenewal).filter(
            LeaseRenewal.lease_id == lease.id,
            LeaseRenewal.status.in_(["sent", "accepted", "declined"]),
        ).order_by(LeaseRenewal.sent_at.desc()).first()
        result.append({
            "lease_id": lease.id,
            "renewal_id": renewal.id if renewal else None,
            "tenant_name": tenant.full_name if tenant else "Unknown",
            "property": prop.name if prop else "—",
            "unit": unit.name if unit else "—",
            "end_date": lease.end_date.isoformat(),
            "days_remaining": days_remaining,
            "monthly_rent": lease.monthly_rent,
            "renewal_status": renewal.status if renewal else None,
            "landlord_viewed_at": renewal.landlord_viewed_at.isoformat() if renewal and renewal.landlord_viewed_at else None,
        })
    return result


@router.get("/portal/inspections")
def portal_inspections(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    """Upcoming and recent inspections across landlord's properties."""
    from app.models.inspection import Inspection
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    if not prop_ids:
        return []
    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    inspections = db.query(Inspection).filter(
        Inspection.unit_id.in_(unit_ids),
    ).order_by(Inspection.scheduled_date.desc()).limit(50).all()

    result = []
    for i in inspections:
        unit = i.unit
        prop = unit.property if unit else None
        result.append({
            "id": i.id,
            "type": i.type.replace("_", " ").title(),
            "status": i.status,
            "scheduled_date": i.scheduled_date.isoformat() if i.scheduled_date else None,
            "completed_date": i.completed_date.isoformat() if i.completed_date else None,
            "inspector_name": i.inspector_name,
            "overall_condition": i.overall_condition,
            "property": prop.name if prop else "—",
            "unit": unit.name if unit else "—",
        })
    return result


@router.get("/portal/statement/{year}/{month}")
def portal_statement(
    year: int,
    month: int,
    landlord: Landlord = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """Monthly rent statement PDF for a given month."""
    import calendar
    if not (1 <= month <= 12) or year < 2000:
        raise HTTPException(status_code=400, detail="Invalid year or month")

    month_start = date(year, month, 1)
    month_end = date(year, month, calendar.monthrange(year, month)[1])
    report_month = month_start.strftime("%B %Y")

    props = db.query(Property).filter(Property.landlord_id == landlord.id).all()
    org = db.query(Organisation).filter(Organisation.id == landlord.organisation_id).first()

    properties_data = []
    for p in props:
        units = db.query(Unit).filter(Unit.property_id == p.id).all()
        unit_data = []
        for u in units:
            lease = db.query(Lease).filter(Lease.unit_id == u.id, Lease.status == "active").first()
            payment = None
            if lease:
                payment = db.query(RentPayment).filter(
                    RentPayment.lease_id == lease.id,
                    RentPayment.due_date >= month_start,
                    RentPayment.due_date <= month_end,
                ).first()
            status = "vacant"
            if lease:
                status = payment.status if payment else "pending"
            unit_data.append({
                "name": u.name,
                "tenant_name": lease.tenant.full_name if lease and lease.tenant else None,
                "expected": payment.amount_due if payment else (lease.monthly_rent if lease else 0),
                "collected": payment.amount_paid or 0 if payment and payment.status == "paid" else 0,
                "status": status,
            })
        properties_data.append({
            "name": p.name,
            "address": f"{p.address_line1}, {p.city}, {p.postcode}",
            "units": unit_data,
        })

    pdf = docgen.generate_financial_report(
        landlord, properties_data, [], [], report_month, org.name if org else "PropAIrty"
    )
    filename = f"Statement-{report_month.replace(' ', '-')}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# --- Landlord ↔ Agent Messages ---

class MessageIn(BaseModel):
    body: str


@router.get("/portal/messages")
def portal_messages(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    """Return full message thread between this landlord and their agency."""
    from app.models.portal_message import PortalMessage
    msgs = (
        db.query(PortalMessage)
        .filter(
            PortalMessage.organisation_id == landlord.organisation_id,
            PortalMessage.landlord_id == landlord.id,
        )
        .order_by(PortalMessage.created_at.asc())
        .all()
    )
    # Mark unread agent messages as read now that landlord has fetched them
    from datetime import datetime, timezone as tz
    unread = [m for m in msgs if m.sender_type == "agent" and not m.read]
    for m in unread:
        m.read = True
        m.read_at = datetime.now(tz.utc)
    if unread:
        db.commit()
    return [
        {
            "id": m.id,
            "sender_type": m.sender_type,
            "body": m.body,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in msgs
    ]


@router.get("/portal/messages/unread-count")
def landlord_messages_unread(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    from app.models.portal_message import PortalMessage
    count = db.query(PortalMessage).filter(
        PortalMessage.landlord_id == landlord.id,
        PortalMessage.sender_type == "agent",
        PortalMessage.read == False,
    ).count()
    return {"count": count}


@router.post("/portal/messages")
def portal_send_message(req: MessageIn, landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    """Landlord sends a message to their agent."""
    from app.models.portal_message import PortalMessage
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message body cannot be empty")
    msg = PortalMessage(
        organisation_id=landlord.organisation_id,
        landlord_id=landlord.id,
        sender_type="landlord",
        body=body,
        read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    # Email all agents in this org
    try:
        org = db.query(Organisation).filter(Organisation.id == landlord.organisation_id).first()
        agents = db.query(User).filter(User.organisation_id == landlord.organisation_id, User.is_active == True).all()
        agent_emails_list = [u.email for u in agents if u.email]
        _emails.send_agent_new_landlord_message(agent_emails_list, landlord, req.body.strip(), org)
    except Exception as e:
        print(f"[email] landlord message notify failed: {e}")
    return {"id": msg.id, "sender_type": msg.sender_type, "body": msg.body, "created_at": msg.created_at.isoformat()}


# --- Agent-side: view and reply to landlord messages ---

@router.get("/messages/inbox")
def agent_landlord_inbox(agent: User = Depends(get_agent), db: Session = Depends(get_db)):
    """All landlord conversations for this org, grouped by landlord, most recent first."""
    from app.models.portal_message import PortalMessage
    msgs = (
        db.query(PortalMessage)
        .filter(PortalMessage.organisation_id == agent.organisation_id)
        .order_by(PortalMessage.created_at.desc())
        .all()
    )
    seen = {}
    for m in msgs:
        if m.landlord_id not in seen:
            landlord = db.query(Landlord).filter(Landlord.id == m.landlord_id).first()
            seen[m.landlord_id] = {
                "landlord_id": m.landlord_id,
                "landlord_name": landlord.full_name if landlord else "Unknown",
                "landlord_email": landlord.email if landlord else "",
                "last_message": m.body,
                "last_message_at": m.created_at.isoformat() if m.created_at else None,
                "last_sender": m.sender_type,
                "unread": 0,
            }
        if m.sender_type == "landlord" and not m.read:
            seen[m.landlord_id]["unread"] += 1
    return list(seen.values())


@router.get("/messages/{landlord_id}")
def agent_get_messages(landlord_id: int, agent: User = Depends(get_agent), db: Session = Depends(get_db)):
    """Agent views message thread with a specific landlord."""
    from app.models.portal_message import PortalMessage
    landlord = db.query(Landlord).filter(
        Landlord.id == landlord_id,
        Landlord.organisation_id == agent.organisation_id,
    ).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    msgs = (
        db.query(PortalMessage)
        .filter(
            PortalMessage.landlord_id == landlord_id,
            PortalMessage.organisation_id == agent.organisation_id,
        )
        .order_by(PortalMessage.created_at.asc())
        .all()
    )
    # Mark unread landlord messages as read now that agent has fetched them
    unread = [m for m in msgs if m.sender_type == "landlord" and not m.read]
    for m in unread:
        m.read = True
    if unread:
        db.commit()
    return [
        {
            "id": m.id,
            "sender_type": m.sender_type,
            "body": m.body,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "read_at": m.read_at.isoformat() if m.read_at else None,
        }
        for m in msgs
    ]


@router.post("/messages/{landlord_id}")
def agent_send_message(landlord_id: int, req: MessageIn, agent: User = Depends(get_agent), db: Session = Depends(get_db)):
    """Agent replies to a landlord's message thread."""
    from app.models.portal_message import PortalMessage
    landlord = db.query(Landlord).filter(
        Landlord.id == landlord_id,
        Landlord.organisation_id == agent.organisation_id,
    ).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message body cannot be empty")
    msg = PortalMessage(
        organisation_id=agent.organisation_id,
        landlord_id=landlord_id,
        sender_type="agent",
        body=body,
        read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    # Notify landlord via their chosen channels
    try:
        org = db.query(Organisation).filter(Organisation.id == agent.organisation_id).first()
        agent_name = agent.full_name or agent.email
        _emails.send_portal_message_notification(
            landlord, agent_name, req.body.strip(), org,
            "https://propairty.co.uk/landlord/portal"
        )
    except Exception as e:
        print(f"[email] landlord reply notify failed: {e}")
    return {"id": msg.id, "sender_type": msg.sender_type, "body": msg.body, "created_at": msg.created_at.isoformat()}


# --- View tracking endpoints ---

@router.post("/portal/renewals/{renewal_id}/viewed")
def portal_renewal_viewed(
    renewal_id: int,
    landlord: Landlord = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    from app.models.renewal import LeaseRenewal
    from datetime import datetime, timezone as tz
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    lease_ids = [l.id for l in db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all()]
    renewal = db.query(LeaseRenewal).filter(
        LeaseRenewal.id == renewal_id,
        LeaseRenewal.lease_id.in_(lease_ids),
    ).first()
    if renewal and not renewal.landlord_viewed_at:
        renewal.landlord_viewed_at = datetime.now(tz.utc)
        db.commit()
    return {"ok": True}


@router.post("/portal/report/viewed")
def portal_report_viewed(
    landlord: Landlord = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    from app.models.landlord_report_view import LandlordReportView
    from datetime import date
    report_month = date.today().strftime("%B %Y")
    view = LandlordReportView(landlord_id=landlord.id, report_month=report_month)
    db.add(view)
    db.commit()
    return {"ok": True}


# ── Notification preferences ──────────────────────────────────────────────────

import secrets as _secrets_ll
from pydantic import BaseModel as _LLNotifBM

class LLNotifPrefsIn(_LLNotifBM):
    notify_email: bool = False
    notify_whatsapp: bool = False
    notify_telegram: bool = False
    whatsapp_number: str = ""

@router.get("/portal/notification-prefs")
def get_landlord_notif_prefs(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    if not landlord.telegram_link_code:
        landlord.telegram_link_code = _secrets_ll.token_hex(4).upper()
        db.commit()
    return {
        "notify_email": landlord.notify_email or False,
        "notify_whatsapp": landlord.notify_whatsapp or False,
        "notify_telegram": landlord.notify_telegram or False,
        "whatsapp_number": landlord.whatsapp_number or "",
        "telegram_chat_id": landlord.telegram_chat_id or "",
        "telegram_link_code": landlord.telegram_link_code or "",
        "telegram_linked": bool(landlord.telegram_chat_id),
    }

@router.put("/portal/notification-prefs")
def save_landlord_notif_prefs(data: LLNotifPrefsIn, landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    landlord.notify_email = data.notify_email
    landlord.notify_whatsapp = data.notify_whatsapp
    landlord.notify_telegram = data.notify_telegram
    if data.whatsapp_number:
        landlord.whatsapp_number = data.whatsapp_number.strip()
    db.commit()
    return {"ok": True}


# ── AI chat ───────────────────────────────────────────────────────────────────

from pydantic import BaseModel as _AIBM_LL
from typing import List as _List_LL

class _LLPortalMsg(_AIBM_LL):
    role: str
    content: str

class _LLPortalChatReq(_AIBM_LL):
    messages: _List_LL[_LLPortalMsg]

@router.post("/portal/ai-chat")
def landlord_ai_chat(req: _LLPortalChatReq, landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    from app.routers.ai import _portal_chat_with_tools, _landlord_context
    from app import wendy as _wendy
    from app.models.portal_message import PortalMessage

    def _send_message(body: str) -> dict:
        msg = PortalMessage(
            organisation_id=landlord.organisation_id,
            landlord_id=landlord.id,
            sender_type="landlord",
            body=body.strip(),
            read=False,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        try:
            agents = db.query(User).filter(User.organisation_id == landlord.organisation_id, User.is_active == True).all()
            org = db.query(Organisation).filter(Organisation.id == landlord.organisation_id).first()
            agent_emails = [u.email for u in agents if u.email]
            _emails.send_agent_new_landlord_message(agent_emails, landlord, body.strip(), org)
        except Exception:
            pass
        return {"sent": True, "message_id": msg.id}

    tools = [{
        "type": "function",
        "function": {
            "name": "send_message_to_agent",
            "description": "Send a message to the letting agent on behalf of the landlord.",
            "parameters": {
                "type": "object",
                "properties": {"body": {"type": "string", "description": "The full message text to send"}},
                "required": ["body"]
            }
        }
    }]
    context = _landlord_context(landlord, db)
    msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    return _portal_chat_with_tools(msgs, _wendy.get('mendy_landlord'), context, tools, {"send_message_to_agent": _send_message})


# ── Notices (for landlord portal) ─────────────────────────────────────────────

@router.get("/portal/notices")
def portal_notices(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    from app.models.notice import LegalNotice
    from app.models.tenant import Tenant as TenantModel
    prop_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == landlord.id).all()]
    if not prop_ids:
        return []
    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    lease_ids = [l.id for l in db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all()]
    notices = db.query(LegalNotice).filter(LegalNotice.lease_id.in_(lease_ids)).order_by(LegalNotice.created_at.desc()).all()
    result = []
    for n in notices:
        lease = db.query(Lease).filter(Lease.id == n.lease_id).first()
        tenant_name = ""
        prop_name = ""
        if lease:
            t = db.query(TenantModel).filter(TenantModel.id == lease.tenant_id).first()
            tenant_name = t.full_name if t else ""
            u = db.query(Unit).filter(Unit.id == lease.unit_id).first()
            if u:
                p = db.query(Property).filter(Property.id == u.property_id).first()
                prop_name = f"{p.name} – {u.name}" if p else u.name
        result.append({
            "id": n.id,
            "notice_type": n.notice_type,
            "served_date": n.served_date.isoformat() if n.served_date else None,
            "possession_date": n.possession_date.isoformat() if n.possession_date else None,
            "arrears_amount": n.arrears_amount,
            "custom_notes": n.custom_notes,
            "tenant_name": tenant_name,
            "property": prop_name,
        })
    return result


@router.get("/features")
def get_landlord_features(landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    from app import feature_flags as ff
    return ff.get_org_features(db, landlord.organisation_id, prefix="landlord_")


# ── Landlord CFO ─────────────────────────────────────────────────────────────
# Landlord-perspective P&L: rent income minus maintenance minus agency fee.

@router.get("/cfo")
def landlord_cfo(
    fee_pct: float = 10.0,
    landlord: Landlord = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """Landlord's P&L view: their properties only, their bottom line."""
    from collections import defaultdict
    today = date.today()
    fee_rate = max(0.0, min(fee_pct, 100.0)) / 100.0

    properties = db.query(Property).filter(
        Property.landlord_id == landlord.id,
        Property.organisation_id == landlord.organisation_id,
    ).all()
    if not properties:
        return {
            "kpis": {"net_income_12mo": 0, "gross_rent_12mo": 0, "maintenance_12mo": 0,
                     "agency_fee_12mo": 0, "monthly_rent_roll": 0, "annual_run_rate": 0,
                     "occupancy_pct": 0, "properties": 0, "units": 0, "occupied_units": 0,
                     "yield_pct": 0, "fee_pct": fee_pct},
            "scorecard": [], "push_actions": [], "drop_actions": [], "forecast": [],
        }

    prop_ids = [p.id for p in properties]
    units = db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()
    unit_ids = [u.id for u in units]
    unit_to_prop = {u.id: u.property_id for u in units}
    units_by_prop = defaultdict(list)
    for u in units:
        units_by_prop[u.property_id].append(u)

    leases = db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all() if unit_ids else []
    active = [l for l in leases if l.status == "active"]

    window_start = (today.replace(day=1) - timedelta(days=365)).replace(day=1)
    payments = db.query(RentPayment).filter(
        RentPayment.lease_id.in_([l.id for l in leases]),
        RentPayment.due_date >= window_start,
    ).all() if leases else []
    jobs = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.unit_id.in_(unit_ids),
        MaintenanceRequest.created_at >= window_start,
    ).all() if unit_ids else []

    rent_in: dict[int, float] = defaultdict(float)
    maint: dict[int, float] = defaultdict(float)
    job_n: dict[int, int] = defaultdict(int)
    lease_to_prop = {l.id: unit_to_prop.get(l.unit_id) for l in leases}

    for p in payments:
        pid = lease_to_prop.get(p.lease_id)
        if pid is None: continue
        if p.status in ("paid", "partial"):
            rent_in[pid] += p.amount_paid or 0
    for j in jobs:
        pid = unit_to_prop.get(j.unit_id)
        if pid is None: continue
        maint[pid] += j.actual_cost or 0
        job_n[pid] += 1

    scorecard = []
    for prop in properties:
        prop_units = units_by_prop.get(prop.id, [])
        active_for = [l for l in active if unit_to_prop.get(l.unit_id) == prop.id]
        monthly_rent = sum(l.monthly_rent for l in active_for)
        gross = rent_in.get(prop.id, 0)
        m_cost = maint.get(prop.id, 0)
        fee = gross * fee_rate
        net = gross - m_cost - fee
        occupied = sum(1 for u in prop_units if u.status == "occupied")
        unit_count = len(prop_units)

        # Score landlord-side: net margin, occupancy, low maintenance ratio
        margin = (net / gross * 100) if gross > 0 else 0
        margin_pts = max(0, min(50, margin / 1.5))
        occ_pts = (occupied / unit_count * 30) if unit_count else 0
        maint_ratio = (m_cost / gross * 100) if gross > 0 else 0
        maint_pts = 20 if maint_ratio < 5 else (10 if maint_ratio < 15 else 0)
        score = round(margin_pts + occ_pts + maint_pts)

        if net < 0: verdict = "drop"
        elif score >= 75: verdict = "star"
        elif score >= 50: verdict = "ok"
        else: verdict = "watch"

        scorecard.append({
            "property_id": prop.id,
            "property_name": prop.name,
            "address": f"{prop.address_line1}, {prop.city}",
            "units": unit_count,
            "occupied": occupied,
            "monthly_rent": round(monthly_rent, 2),
            "gross_rent_12mo": round(gross, 2),
            "maintenance_12mo": round(m_cost, 2),
            "agency_fee_12mo": round(fee, 2),
            "net_income_12mo": round(net, 2),
            "margin_pct": round(margin, 1),
            "maintenance_ratio_pct": round(maint_ratio, 1),
            "jobs_12mo": job_n.get(prop.id, 0),
            "score": score,
            "verdict": verdict,
        })
    scorecard.sort(key=lambda s: -s["net_income_12mo"])

    total_gross = sum(s["gross_rent_12mo"] for s in scorecard)
    total_maint = sum(s["maintenance_12mo"] for s in scorecard)
    total_fee = sum(s["agency_fee_12mo"] for s in scorecard)
    total_net = total_gross - total_maint - total_fee
    monthly_rent_roll = sum(s["monthly_rent"] for s in scorecard)
    total_units = sum(s["units"] for s in scorecard)
    total_occ = sum(s["occupied"] for s in scorecard)

    kpis = {
        "gross_rent_12mo": round(total_gross, 2),
        "maintenance_12mo": round(total_maint, 2),
        "agency_fee_12mo": round(total_fee, 2),
        "net_income_12mo": round(total_net, 2),
        "monthly_rent_roll": round(monthly_rent_roll, 2),
        "annual_run_rate": round(monthly_rent_roll * 12, 2),
        "net_run_rate": round(monthly_rent_roll * 12 * (1 - fee_rate) - total_maint, 2),
        "occupancy_pct": round((total_occ / total_units * 100) if total_units else 0, 1),
        "properties": len(scorecard),
        "units": total_units,
        "occupied_units": total_occ,
        "yield_pct": round((total_net / (total_gross or 1)) * 100, 1) if total_gross else 0,
        "fee_pct": fee_pct,
    }

    # Push: rent reviews + renewals coming up (landlord wants higher rent)
    push = []
    for u in units:
        if u.status != "occupied": continue
        lease = next((l for l in active if l.unit_id == u.id), None)
        if not lease or not lease.start_date: continue
        months_on = (today - lease.start_date).days // 30
        if months_on < 12: continue
        peers = [p for p in units if p.property_id == u.property_id and p.id != u.id and p.bedrooms == u.bedrooms]
        peer_rents = [p.monthly_rent for p in peers if p.monthly_rent]
        if peer_rents:
            peer_med = sorted(peer_rents)[len(peer_rents)//2]
            gap = peer_med - u.monthly_rent
            if gap > 50:
                annual = gap * 12
                net_uplift = annual * (1 - fee_rate)
                prop = next((p for p in properties if p.id == u.property_id), None)
                push.append({
                    "type": "rent_review",
                    "title": f"Rent review: {prop.name if prop else ''} · {u.name}",
                    "detail": f"£{u.monthly_rent:.0f}/mo vs £{peer_med:.0f} peers · on rent {months_on}mo",
                    "impact_annual": round(annual, 2),
                    "net_impact_annual": round(net_uplift, 2),
                })
    soon = today + timedelta(days=90)
    for lease in active:
        if not lease.end_date or lease.end_date > soon or lease.end_date < today: continue
        unit = next((u for u in units if u.id == lease.unit_id), None)
        prop = next((p for p in properties if p.id == unit_to_prop.get(lease.unit_id)), None) if unit else None
        annual = lease.monthly_rent * 12
        push.append({
            "type": "renewal",
            "title": f"Renewal due: {prop.name if prop else ''} · {unit.name if unit else ''}",
            "detail": f"Lease ends {lease.end_date.isoformat()} · {(lease.end_date - today).days}d left",
            "impact_annual": round(annual, 2),
            "net_impact_annual": round(annual * (1 - fee_rate), 2),
        })
    push.sort(key=lambda a: -a["net_impact_annual"])

    # Drop: loss-makers — exclude Stars; exclude OKs unless genuinely losing money
    drops = []
    for s in scorecard:
        if s["verdict"] == "star":
            continue
        if s["verdict"] == "ok" and s["net_income_12mo"] >= 0 and s["jobs_12mo"] < 10:
            continue
        reasons = []
        if s["net_income_12mo"] < 0:
            reasons.append(f"net loss £{abs(s['net_income_12mo']):.0f}/yr")
        if s["maintenance_ratio_pct"] > 20 and s["gross_rent_12mo"] > 0:
            reasons.append(f"{s['maintenance_ratio_pct']:.0f}% of rent eaten by repairs")
        if s["jobs_12mo"] >= 6:
            reasons.append(f"{s['jobs_12mo']} jobs in 12mo")
        if s["units"] > 0 and s["occupied"] < s["units"]:
            reasons.append(f"{s['units'] - s['occupied']} unit(s) vacant")
        if not reasons: continue
        drag = max(0, -s["net_income_12mo"]) + s["maintenance_12mo"] * 0.5
        drops.append({
            "property_id": s["property_id"],
            "property_name": s["property_name"],
            "score": s["score"],
            "verdict": s["verdict"],
            "net_income_12mo": s["net_income_12mo"],
            "drag_estimate": round(drag, 2),
            "reasons": reasons,
        })
    drops.sort(key=lambda d: -d["drag_estimate"])

    # Forecast: 12 months net income forward
    forecast = []
    for i in range(12):
        m = today.month + i; y = today.year
        while m > 12:
            m -= 12; y += 1
        first = date(y, m, 1)
        if m == 12:
            last = date(y+1, 1, 1) - timedelta(days=1)
        else:
            last = date(y, m+1, 1) - timedelta(days=1)
        gross = 0.0; ending = 0.0
        for lease in active:
            if lease.start_date and lease.start_date > last: continue
            if lease.end_date and lease.end_date < first: continue
            gross += lease.monthly_rent
            if lease.end_date and first <= lease.end_date <= last:
                ending += lease.monthly_rent
        forecast.append({
            "month": first.strftime("%b %Y"),
            "gross_rent": round(gross, 2),
            "agency_fee": round(gross * fee_rate, 2),
            "net_income": round(gross * (1 - fee_rate), 2),  # before maintenance
            "at_risk_rent": round(ending, 2),
        })

    return {
        "kpis": kpis,
        "scorecard": scorecard,
        "push_actions": push[:15],
        "drop_actions": drops[:10],
        "forecast": forecast,
        "settings": {"fee_pct": fee_pct},
    }
