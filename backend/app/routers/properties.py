from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.property import Property
from app.models.unit import Unit
from app.models.lease import Lease
from app.schemas.property import PropertyCreate, PropertyOut, UnitCreate, UnitOut

router = APIRouter(prefix="/api/properties", tags=["properties"])

@router.get("", response_model=List[PropertyOut])
def list_properties(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Property).options(joinedload(Property.units)).filter(
        Property.organisation_id == current_user.organisation_id
    ).all()

@router.post("", response_model=PropertyOut)
def create_property(data: PropertyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prop = Property(**data.model_dump(), organisation_id=current_user.organisation_id)
    db.add(prop)
    db.commit()
    db.refresh(prop)
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
    return prop

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
    return unit
