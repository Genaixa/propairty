from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.checklist import Checklist, ChecklistItem

router = APIRouter(prefix="/api/checklists", tags=["checklists"])

CHECKLIST_TYPES = ['pre_showing', 'pre_move_in', 'inspection', 'custom']

DEFAULT_ITEMS = {
    'pre_showing': [
        'Keys ready and labelled',
        'Lights switched on throughout',
        'Property cleaned and tidy',
        'Heating/cooling set to comfortable temperature',
        'Garden or communal areas tidy',
        'Any odours addressed',
        'Parking arranged for viewing',
        'Info pack / brochure ready',
        'Meter readings noted before visit',
    ],
    'pre_move_in': [
        'Gas Safety Certificate valid',
        'EICR (electrical report) valid',
        'EPC in date',
        'Smoke alarms tested',
        'Carbon monoxide detector fitted',
        'Deposit registered with scheme',
        'AST signed by all parties',
        'Inventory completed and signed',
        'Keys handed over and logged',
        'Meter readings taken at move-in',
        'Utility accounts transferred',
        'Council tax notified',
        'Welcome pack provided to tenant',
    ],
    'inspection': [
        'Smoke alarms tested',
        'Boiler/heating system checked',
        'Check for damp or mould',
        'Windows and locks functioning',
        'Water pressure checked',
        'Check for pest signs',
        'Garden / outdoor areas assessed',
        'Meter readings recorded',
        'Photos taken of all rooms',
        'Tenant present and report signed',
    ],
    'custom': [],
}


def _item_out(i: ChecklistItem):
    return {
        "id": i.id,
        "label": i.label,
        "position": i.position,
        "checked": i.checked,
        "checked_at": i.checked_at.isoformat() if i.checked_at else None,
        "checked_by": i.checked_by,
    }


def _out(c: Checklist):
    prop = c.property
    return {
        "id": c.id,
        "name": c.name,
        "checklist_type": c.checklist_type,
        "property_id": c.property_id,
        "property_name": prop.name if prop else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "items": [_item_out(i) for i in c.items],
        "progress": f"{sum(1 for i in c.items if i.checked)}/{len(c.items)}" if c.items else "0/0",
    }


class ChecklistCreate(BaseModel):
    name: str
    checklist_type: str = 'custom'
    property_id: Optional[int] = None
    items: Optional[List[str]] = None  # if None, use defaults for type


class ItemUpdate(BaseModel):
    checked: bool
    checked_by: Optional[str] = None


class ItemAdd(BaseModel):
    label: str


@router.get("")
def list_checklists(
    checklist_type: Optional[str] = None,
    property_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Checklist).filter(Checklist.organisation_id == current_user.organisation_id)
    if checklist_type:
        q = q.filter(Checklist.checklist_type == checklist_type)
    if property_id:
        q = q.filter(Checklist.property_id == property_id)
    return [_out(c) for c in q.order_by(Checklist.created_at.desc()).all()]


@router.post("")
def create_checklist(
    data: ChecklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checklist = Checklist(
        organisation_id=current_user.organisation_id,
        name=data.name,
        checklist_type=data.checklist_type,
        property_id=data.property_id,
    )
    db.add(checklist)
    db.flush()

    labels = data.items if data.items is not None else DEFAULT_ITEMS.get(data.checklist_type, [])
    for i, label in enumerate(labels):
        db.add(ChecklistItem(checklist_id=checklist.id, label=label, position=i))

    db.commit()
    db.refresh(checklist)
    return _out(checklist)


@router.get("/{checklist_id}")
def get_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Checklist).filter(
        Checklist.id == checklist_id,
        Checklist.organisation_id == current_user.organisation_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return _out(c)


@router.delete("/{checklist_id}")
def delete_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Checklist).filter(
        Checklist.id == checklist_id,
        Checklist.organisation_id == current_user.organisation_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Checklist not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.patch("/{checklist_id}/items/{item_id}")
def toggle_item(
    checklist_id: int,
    item_id: int,
    data: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Checklist).filter(
        Checklist.id == checklist_id,
        Checklist.organisation_id == current_user.organisation_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Checklist not found")
    item = db.query(ChecklistItem).filter(
        ChecklistItem.id == item_id,
        ChecklistItem.checklist_id == checklist_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.checked = data.checked
    item.checked_at = datetime.utcnow() if data.checked else None
    item.checked_by = data.checked_by if data.checked else None
    db.commit()
    return _item_out(item)


@router.post("/{checklist_id}/items")
def add_item(
    checklist_id: int,
    data: ItemAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Checklist).filter(
        Checklist.id == checklist_id,
        Checklist.organisation_id == current_user.organisation_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Checklist not found")
    pos = max((i.position for i in c.items), default=-1) + 1
    item = ChecklistItem(checklist_id=checklist_id, label=data.label, position=pos)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_out(item)


@router.delete("/{checklist_id}/items/{item_id}")
def delete_item(
    checklist_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Checklist).filter(
        Checklist.id == checklist_id,
        Checklist.organisation_id == current_user.organisation_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Checklist not found")
    item = db.query(ChecklistItem).filter(
        ChecklistItem.id == item_id,
        ChecklistItem.checklist_id == checklist_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
