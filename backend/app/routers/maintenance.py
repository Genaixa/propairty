from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.maintenance import MaintenanceRequest
from app.models.unit import Unit
from app.models.property import Property
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut
from app import notifications, emails
from app.routers import dispatch as dispatch_router
from app.models.tenant import Tenant
from app.models.lease import Lease
from app.models.organisation import Organisation

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])

@router.get("", response_model=List[MaintenanceOut])
def list_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()

@router.post("", response_model=MaintenanceOut)
def create_request(data: MaintenanceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    unit = db.query(Unit).join(Property).filter(
        Unit.id == data.unit_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    req = MaintenanceRequest(
        **data.model_dump(),
        organisation_id=current_user.organisation_id,
        property_id=unit.property_id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    # Instant Telegram alert for new requests
    unit = db.query(Unit).join(Property).filter(Unit.id == req.unit_id).first()
    unit_name = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
    notifications.notify_new_maintenance(req.title, unit_name, req.priority, req.reported_by or "")
    # AI triage and dispatch queue
    try:
        dispatch_router.enqueue_job(req, db)
    except Exception as e:
        print(f"[dispatch] enqueue failed: {e}")
    return req

@router.put("/{req_id}", response_model=MaintenanceOut)
def update_request(req_id: int, data: MaintenanceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        MaintenanceRequest.id == req_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    old_status = req.status
    for k, v in data.model_dump().items():
        setattr(req, k, v)
    db.commit()
    db.refresh(req)
    # Email tenant if status changed and job was submitted by a tenant
    if req.status != old_status and req.reported_by_tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == req.reported_by_tenant_id).first()
        org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
        if tenant and org:
            emails.send_maintenance_update(tenant, req.title, req.status, org)
    return req
