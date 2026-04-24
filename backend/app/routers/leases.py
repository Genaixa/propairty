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
    new_start = data.start_date
    new_end = data.end_date  # None = periodic (no fixed end)
    for existing in db.query(Lease).filter(Lease.unit_id == data.unit_id, Lease.status == "active").all():
        ex_start = existing.start_date
        ex_end = existing.end_date  # None = periodic
        # Two date ranges overlap when: new starts before existing ends AND existing starts before new ends
        new_before_ex_ends = (ex_end is None or new_start <= ex_end)
        ex_before_new_ends = (new_end is None or ex_start <= new_end)
        if new_before_ex_ends and ex_before_new_ends:
            ex_end_str = str(ex_end) if ex_end else "no end date (periodic)"
            raise HTTPException(
                status_code=409,
                detail=f"Date overlap with an existing active lease ({ex_start} – {ex_end_str}). Adjust the start date to after the current lease ends."
            )
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
