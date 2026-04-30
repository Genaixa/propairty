from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user, get_accessible_property_ids, require_write
from app.models.user import User
from app.models.property import Property
from app.models.unit import Unit
from app.models.lease import Lease
from app.models.tenant import Tenant
from app.models.maintenance import MaintenanceRequest
from app.models.upload import UploadedFile
from app.models.inspection import Inspection
from app.models.inventory import Inventory
from app.models.compliance import ComplianceCertificate, CERT_TYPES
from app.schemas.property import PropertyCreate, PropertyOut, UnitCreate, UnitOut

router = APIRouter(prefix="/api/properties", tags=["properties"])

@router.get("")
def list_properties(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Property).options(joinedload(Property.units)).filter(
        Property.organisation_id == current_user.organisation_id
    )
    allowed = get_accessible_property_ids(db, current_user)
    if allowed is not None:
        q = q.filter(Property.id.in_(allowed))
    props = q.all()
    result = []
    for p in props:
        first_photo = db.query(UploadedFile).filter(
            UploadedFile.entity_type == "property",
            UploadedFile.entity_id == p.id,
            UploadedFile.mime_type.like("image/%"),
        ).order_by(UploadedFile.created_at.asc()).first()
        result.append({
            "id": p.id,
            "name": p.name,
            "address_line1": p.address_line1,
            "address_line2": p.address_line2,
            "city": p.city,
            "postcode": p.postcode,
            "property_type": p.property_type,
            "description": p.description,
            "epc_rating": p.epc_rating,
            "cover_photo": f"/uploads/{first_photo.filename}" if first_photo else None,
            "units": [{"id": u.id, "name": u.name, "status": u.status, "monthly_rent": u.monthly_rent, "bedrooms": u.bedrooms, "bathrooms": u.bathrooms, "epc_rating": u.epc_rating} for u in p.units],
        })
    return result

@router.post("", response_model=PropertyOut)
def create_property(data: PropertyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = Property(**data.model_dump(), organisation_id=current_user.organisation_id)
    db.add(prop)
    db.commit()
    db.refresh(prop)
    # Brochure will be generated on first request — no cache to invalidate yet
    return prop

@router.get("/{property_id}", response_model=PropertyOut)
def get_property(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).options(joinedload(Property.units)).filter(
        Property.id == property_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop

@router.put("/{property_id}", response_model=PropertyOut)
def update_property(property_id: int, data: PropertyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).filter(Property.id == property_id, Property.organisation_id == current_user.organisation_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    for k, v in data.model_dump().items():
        setattr(prop, k, v)
    db.commit()
    db.refresh(prop)
    from app.brochure import invalidate_brochure_cache
    invalidate_brochure_cache(property_id)
    return prop

@router.post("/{property_id}/toggle-featured")
def toggle_featured(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).filter(Property.id == property_id, Property.organisation_id == current_user.organisation_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    prop.featured = not bool(prop.featured)
    db.commit()
    return {"featured": prop.featured}

@router.delete("/{property_id}")
def delete_property(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).filter(Property.id == property_id, Property.organisation_id == current_user.organisation_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    active_lease = (
        db.query(Lease)
        .join(Unit, Lease.unit_id == Unit.id)
        .filter(Unit.property_id == property_id, Lease.status == "active")
        .first()
    )
    if active_lease:
        raise HTTPException(status_code=400, detail="Cannot delete a property with active leases")
    db.delete(prop)
    db.commit()
    return {"ok": True}

@router.post("/{property_id}/units", response_model=UnitOut)
def create_unit(property_id: int, data: UnitCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).filter(Property.id == property_id, Property.organisation_id == current_user.organisation_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    unit = Unit(**data.model_dump(), property_id=property_id)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    from app.brochure import invalidate_brochure_cache
    invalidate_brochure_cache(property_id)
    return unit


class UnitUpdate(BaseModel):
    amenities: Optional[str] = None
    rooms: Optional[str] = None
    name: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    monthly_rent: Optional[float] = None
    status: Optional[str] = None
    occupancy_type: Optional[str] = None
    max_occupants: Optional[int] = None
    occupancy_notes: Optional[str] = None

class VacateRequest(BaseModel):
    reason: str = ""
    end_date: Optional[str] = None


@router.put("/{property_id}/units/{unit_id}")
def update_unit(property_id: int, unit_id: int, data: UnitUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    unit = db.query(Unit).join(Property).filter(
        Unit.id == unit_id, Unit.property_id == property_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(unit, k, v)
    db.commit()
    db.refresh(unit)
    from app.brochure import invalidate_brochure_cache
    invalidate_brochure_cache(property_id)
    return {"ok": True}


@router.post("/{property_id}/units/{unit_id}/vacate")
def vacate_unit(property_id: int, unit_id: int, data: VacateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    unit = db.query(Unit).join(Property).filter(
        Unit.id == unit_id, Unit.property_id == property_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    from datetime import date as date_type
    end = date_type.fromisoformat(data.end_date) if data.end_date else date_type.today()
    active_lease = db.query(Lease).filter(Lease.unit_id == unit_id, Lease.status == "active").first()
    if active_lease:
        active_lease.status = "terminated"
        active_lease.end_date = end
    unit.status = "vacant"
    db.commit()
    return {"ok": True}


@router.get("/{property_id}/detail")
def get_property_detail(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).options(joinedload(Property.units)).filter(
        Property.id == property_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    units_out = []
    for u in prop.units:
        active_lease = db.query(Lease).filter(
            Lease.unit_id == u.id,
            Lease.status == "active"
        ).first()
        tenant = db.query(Tenant).filter(Tenant.id == active_lease.tenant_id).first() if active_lease else None
        open_jobs = db.query(MaintenanceRequest).filter(
            MaintenanceRequest.unit_id == u.id,
            MaintenanceRequest.status.notin_(["completed", "cancelled"])
        ).count()
        units_out.append({
            "id": u.id,
            "name": u.name,
            "bedrooms": u.bedrooms,
            "bathrooms": u.bathrooms,
            "monthly_rent": u.monthly_rent,
            "status": u.status,
            "open_maintenance": open_jobs,
            "lease": {
                "id": active_lease.id,
                "start_date": str(active_lease.start_date),
                "end_date": str(active_lease.end_date) if active_lease.end_date else None,
                "deposit": active_lease.deposit,
                "is_periodic": active_lease.is_periodic,
            } if active_lease else None,
            "tenant": {
                "id": tenant.id,
                "full_name": tenant.full_name,
                "email": tenant.email,
                "phone": tenant.phone,
                "avatar_url": tenant.avatar_url,
            } if tenant else None,
        })

    # Photos uploaded against this property
    photos = db.query(UploadedFile).filter(
        UploadedFile.entity_type == "property",
        UploadedFile.entity_id == property_id,
        UploadedFile.mime_type.like("image/%"),
    ).order_by(UploadedFile.created_at.asc()).all()

    open_maintenance_total = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.property_id == property_id,
        MaintenanceRequest.status.notin_(["completed", "cancelled"])
    ).count()

    return {
        "id": prop.id,
        "name": prop.name,
        "address_line1": prop.address_line1,
        "address_line2": prop.address_line2,
        "city": prop.city,
        "postcode": prop.postcode,
        "property_type": prop.property_type,
        "description": prop.description,
        "epc_rating": prop.epc_rating,
        "epc_potential": prop.epc_potential,
        "tenure": prop.tenure,
        "council_tax_band": prop.council_tax_band,
        "bills_included": prop.bills_included,
        "reference_number": prop.reference_number,
        "features": prop.features,
        "virtual_tour_url": prop.virtual_tour_url,
        "created_at": str(prop.created_at)[:10],
        "units": units_out,
        "open_maintenance": open_maintenance_total,
        "photos": [{"id": p.id, "url": f"/uploads/{p.filename}", "name": p.original_name, "category": p.category} for p in photos],
    }


@router.get("/{property_id}/history")
def get_property_history(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    unit_ids = [u.id for u in prop.units]

    # All leases for this property (all statuses)
    leases = db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).order_by(Lease.start_date.desc()).all()
    lease_ids = [l.id for l in leases]
    tenant_map = {}
    for l in leases:
        if l.tenant_id and l.tenant_id not in tenant_map:
            t = db.query(Tenant).filter(Tenant.id == l.tenant_id).first()
            if t:
                tenant_map[l.tenant_id] = {"id": t.id, "name": t.full_name, "email": t.email}
    unit_map = {u.id: u.name for u in prop.units}

    leases_out = [{
        "id": l.id,
        "unit": unit_map.get(l.unit_id, "—"),
        "tenant_id": l.tenant_id,
        "tenant": tenant_map.get(l.tenant_id, {}).get("name", "—"),
        "start_date": str(l.start_date),
        "end_date": str(l.end_date) if l.end_date else None,
        "monthly_rent": l.monthly_rent,
        "status": l.status,
        "is_periodic": l.is_periodic,
    } for l in leases]

    # Maintenance
    maintenance = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.unit_id.in_(unit_ids)
    ).order_by(MaintenanceRequest.created_at.desc()).all()

    maintenance_out = [{
        "id": m.id,
        "title": m.title,
        "unit": unit_map.get(m.unit_id, "—"),
        "status": m.status,
        "priority": m.priority,
        "created_at": str(m.created_at)[:10],
    } for m in maintenance]

    # Inspections
    inspections = db.query(Inspection).filter(
        Inspection.unit_id.in_(unit_ids)
    ).order_by(Inspection.scheduled_date.desc()).all()

    inspections_out = [{
        "id": i.id,
        "type": i.type,
        "unit": unit_map.get(i.unit_id, "—"),
        "status": i.status,
        "scheduled_date": str(i.scheduled_date),
        "inspector": i.inspector_name if hasattr(i, 'inspector_name') else None,
    } for i in inspections]

    # Inventories (via leases)
    inventories = db.query(Inventory).filter(
        Inventory.lease_id.in_(lease_ids)
    ).order_by(Inventory.inv_date.desc()).all() if lease_ids else []

    inventories_out = [{
        "id": iv.id,
        "inv_type": iv.inv_type,
        "inv_date": str(iv.inv_date),
        "status": iv.status,
        "conducted_by": iv.conducted_by,
        "tenant_acknowledged_at": str(iv.tenant_acknowledged_at)[:10] if iv.tenant_acknowledged_at else None,
    } for iv in inventories]

    # Compliance certificates
    certs = db.query(ComplianceCertificate).filter(
        ComplianceCertificate.property_id == property_id,
    ).order_by(ComplianceCertificate.expiry_date.desc()).all()

    from datetime import date
    today = date.today()
    certs_out = [{
        "id": c.id,
        "cert_type": c.cert_type,
        "label": CERT_TYPES.get(c.cert_type, {}).get("label", c.cert_type),
        "issue_date": str(c.issue_date),
        "expiry_date": str(c.expiry_date),
        "expired": c.expiry_date < today,
        "contractor": c.contractor,
        "reference": c.reference,
    } for c in certs]

    # Documents (property + units + leases)
    entity_filters = [
        (UploadedFile.entity_type == "property") & (UploadedFile.entity_id == property_id),
    ]
    if unit_ids:
        entity_filters.append((UploadedFile.entity_type == "unit") & (UploadedFile.entity_id.in_(unit_ids)))
    if lease_ids:
        entity_filters.append((UploadedFile.entity_type == "lease") & (UploadedFile.entity_id.in_(lease_ids)))

    from sqlalchemy import or_
    docs = db.query(UploadedFile).filter(
        UploadedFile.organisation_id == current_user.organisation_id,
        or_(*entity_filters),
    ).order_by(UploadedFile.created_at.desc()).all()

    docs_out = [{
        "id": d.id,
        "name": d.original_name,
        "category": d.category,
        "entity_type": d.entity_type,
        "mime_type": d.mime_type,
        "created_at": str(d.created_at)[:10],
        "url": f"/uploads/{d.filename}",
    } for d in docs]

    return {
        "leases": leases_out,
        "maintenance": maintenance_out,
        "inspections": inspections_out,
        "inventories": inventories_out,
        "compliance": certs_out,
        "documents": docs_out,
    }


@router.get("/{property_id}/units/{unit_id}/detail")
def get_unit_detail(property_id: int, unit_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    unit = db.query(Unit).join(Property).filter(
        Unit.id == unit_id,
        Unit.property_id == property_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    prop = db.query(Property).get(property_id)

    # All leases for this unit, most recent first
    leases = db.query(Lease).filter(Lease.unit_id == unit_id).order_by(Lease.start_date.desc()).all()
    active_lease = next((l for l in leases if l.status == "active"), None)
    tenant = db.query(Tenant).filter(Tenant.id == active_lease.tenant_id).first() if active_lease else None

    leases_out = []
    for l in leases:
        t = db.query(Tenant).filter(Tenant.id == l.tenant_id).first()
        leases_out.append({
            "id": l.id,
            "status": l.status,
            "start_date": str(l.start_date),
            "end_date": str(l.end_date) if l.end_date else None,
            "monthly_rent": l.monthly_rent,
            "deposit": l.deposit,
            "is_periodic": l.is_periodic,
            "tenant": {"id": t.id, "full_name": t.full_name, "email": t.email, "phone": t.phone, "avatar_url": t.avatar_url} if t else None,
        })

    # Maintenance history
    jobs = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.unit_id == unit_id
    ).order_by(MaintenanceRequest.created_at.desc()).all()
    jobs_out = [{"id": j.id, "title": j.title, "priority": j.priority, "status": j.status, "created_at": str(j.created_at)[:10]} for j in jobs]

    # Photos
    photos = db.query(UploadedFile).filter(
        UploadedFile.entity_type == "unit",
        UploadedFile.entity_id == unit_id,
        UploadedFile.mime_type.like("image/%"),
    ).order_by(UploadedFile.created_at.asc()).all()

    return {
        "id": unit.id,
        "name": unit.name,
        "bedrooms": unit.bedrooms,
        "bathrooms": unit.bathrooms,
        "monthly_rent": unit.monthly_rent,
        "status": unit.status,
        "amenities": unit.amenities,
        "rooms": unit.rooms,
        "occupancy_type": unit.occupancy_type,
        "max_occupants": unit.max_occupants,
        "occupancy_notes": unit.occupancy_notes,
        "property_id": prop.id,
        "property_name": prop.name,
        "property_address": f"{prop.address_line1}, {prop.city}",
        "leases": leases_out,
        "active_tenant": {"id": tenant.id, "full_name": tenant.full_name, "email": tenant.email, "phone": tenant.phone, "avatar_url": tenant.avatar_url} if tenant else None,
        "maintenance": jobs_out,
        "photos": [{"id": p.id, "url": f"/uploads/{p.filename}", "original_name": p.original_name} for p in photos],
    }
