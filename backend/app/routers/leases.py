from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.schemas.lease import LeaseCreate, LeaseOut

router = APIRouter(prefix="/api/leases", tags=["leases"])

def _check_lease_org(lease_id: int, org_id: int, db: Session):
    lease = db.query(Lease).join(Unit).join(Property).filter(
        Lease.id == lease_id,
        Property.organisation_id == org_id
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    return lease

@router.get("", response_model=List[LeaseOut])
def list_leases(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()

@router.post("", response_model=LeaseOut)
def create_lease(data: LeaseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    unit = db.query(Unit).join(Property).filter(
        Unit.id == data.unit_id,
        Property.organisation_id == current_user.organisation_id
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    lease = Lease(**data.model_dump())
    unit.status = "occupied"
    db.add(lease)
    db.commit()
    db.refresh(lease)
    return lease

@router.get("/{lease_id}", response_model=LeaseOut)
def get_lease(lease_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _check_lease_org(lease_id, current_user.organisation_id, db)

@router.put("/{lease_id}", response_model=LeaseOut)
def update_lease(lease_id: int, data: LeaseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lease = _check_lease_org(lease_id, current_user.organisation_id, db)
    for k, v in data.model_dump().items():
        setattr(lease, k, v)
    db.commit()
    db.refresh(lease)
    return lease

@router.delete("/{lease_id}")
def delete_lease(lease_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lease = _check_lease_org(lease_id, current_user.organisation_id, db)
    unit = db.query(Unit).filter(Unit.id == lease.unit_id).first()
    db.delete(lease)
    if unit:
        # Reset unit to vacant if no other active leases remain
        other_active = db.query(Lease).filter(
            Lease.unit_id == unit.id, Lease.status == "active", Lease.id != lease_id
        ).first()
        if not other_active:
            unit.status = "vacant"
    db.commit()
    return {"ok": True}
