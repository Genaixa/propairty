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


@router.get("/me")
def landlord_me(landlord: Landlord = Depends(get_current_landlord)):
    return {
        "id": landlord.id,
        "full_name": landlord.full_name,
        "email": landlord.email,
        "phone": landlord.phone,
    }


# --- CRUD for agents to manage landlords ---

class LandlordCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None


class LandlordOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None

    class Config:
        from_attributes = True


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
        hashed_password=hash_password(req.password),
        phone=req.phone,
    )
    db.add(landlord)
    db.commit()
    db.refresh(landlord)
    return landlord


@router.get("/landlords", response_model=list[LandlordOut])
def list_landlords(db: Session = Depends(get_db), agent: User = Depends(get_agent)):
    return db.query(Landlord).filter(Landlord.organisation_id == agent.organisation_id).all()


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
    """Documents attached to landlord's properties and their leases/units."""
    from app.models.upload import UploadedFile
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

    return [
        {
            "id": f.id,
            "original_name": f.original_name,
            "category": f.category,
            "description": f.description,
            "entity_type": f.entity_type,
            "entity_id": f.entity_id,
            "file_size": f.file_size,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in files
    ]


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
            "tenant_name": tenant.full_name if tenant else "Unknown",
            "property": prop.name if prop else "—",
            "unit": unit.name if unit else "—",
            "end_date": lease.end_date.isoformat(),
            "days_remaining": days_remaining,
            "monthly_rent": lease.monthly_rent,
            "renewal_status": renewal.status if renewal else None,
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
    unread = [m for m in msgs if m.sender_type == "agent" and not m.read]
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
        }
        for m in msgs
    ]


@router.post("/portal/messages")
def portal_send_message(req: MessageIn, landlord: Landlord = Depends(get_current_landlord), db: Session = Depends(get_db)):
    """Landlord sends a message to their agent."""
    from app.models.portal_message import PortalMessage
    import html
    body = html.escape(req.body.strip())
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
    return {"id": msg.id, "sender_type": msg.sender_type, "body": msg.body, "created_at": msg.created_at.isoformat()}


# --- Agent-side: view and reply to landlord messages ---

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
        }
        for m in msgs
    ]


@router.post("/messages/{landlord_id}")
def agent_send_message(landlord_id: int, req: MessageIn, agent: User = Depends(get_agent), db: Session = Depends(get_db)):
    """Agent replies to a landlord's message thread."""
    from app.models.portal_message import PortalMessage
    import html
    landlord = db.query(Landlord).filter(
        Landlord.id == landlord_id,
        Landlord.organisation_id == agent.organisation_id,
    ).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    body = html.escape(req.body.strip())
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
    return {"id": msg.id, "sender_type": msg.sender_type, "body": msg.body, "created_at": msg.created_at.isoformat()}
