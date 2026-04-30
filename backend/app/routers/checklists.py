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

DEFAULT_TEMPLATES = {
    'pre_showing': {
        'name': 'Pre-Showing',
        'items': [
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
    },
    'pre_move_in': {
        'name': 'Pre-Move-In',
        'items': [
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
    },
}


def _ensure_templates(org_id: int, db: Session):
    count = db.query(Checklist).filter(
        Checklist.organisation_id == org_id,
        Checklist.is_template == True,
    ).count()
    if count == 0:
        for type_key, tpl in DEFAULT_TEMPLATES.items():
            c = Checklist(
                organisation_id=org_id,
                name=tpl['name'],
                checklist_type=type_key,
                is_template=True,
            )
            db.add(c)
            db.flush()
            for i, label in enumerate(tpl['items']):
                db.add(ChecklistItem(checklist_id=c.id, label=label, position=i))
        db.commit()


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
        "is_template": c.is_template,
        "property_id": c.property_id,
        "property_name": prop.name if prop else None,
        "unit_name": c.unit_name,
        "tenant_name": c.tenant_name,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "items": [_item_out(i) for i in c.items],
        "progress": f"{sum(1 for i in c.items if i.checked)}/{len(c.items)}" if c.items else "0/0",
    }


def _get_or_404(checklist_id: int, org_id: int, db: Session) -> Checklist:
    c = db.query(Checklist).filter(
        Checklist.id == checklist_id,
        Checklist.organisation_id == org_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return c


# ── Schemas ────────────────────────────────────────────────────────────────────

class ChecklistCreate(BaseModel):
    name: str
    checklist_type: str = 'custom'
    is_template: bool = False
    property_id: Optional[int] = None
    unit_name: Optional[str] = None
    tenant_name: Optional[str] = None
    items: Optional[List[str]] = None


class ChecklistUpdate(BaseModel):
    name: Optional[str] = None
    property_id: Optional[int] = None
    unit_name: Optional[str] = None
    tenant_name: Optional[str] = None


class UseTemplate(BaseModel):
    property_id: Optional[int] = None
    unit_name: Optional[str] = None
    tenant_name: Optional[str] = None


class ItemUpdate(BaseModel):
    checked: bool
    checked_by: Optional[str] = None


class ItemAdd(BaseModel):
    label: str


class ItemRename(BaseModel):
    label: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/templates")
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_templates(current_user.organisation_id, db)
    templates = db.query(Checklist).filter(
        Checklist.organisation_id == current_user.organisation_id,
        Checklist.is_template == True,
    ).order_by(Checklist.id).all()
    return [_out(t) for t in templates]


@router.post("/templates")
def create_template(
    data: ChecklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = Checklist(
        organisation_id=current_user.organisation_id,
        name=data.name,
        checklist_type=data.checklist_type,
        is_template=True,
    )
    db.add(c)
    db.flush()
    for i, label in enumerate(data.items or []):
        db.add(ChecklistItem(checklist_id=c.id, label=label, position=i))
    db.commit()
    db.refresh(c)
    return _out(c)


@router.post("/{checklist_id}/use")
def use_template(
    checklist_id: int,
    data: UseTemplate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = _get_or_404(checklist_id, current_user.organisation_id, db)
    if not template.is_template:
        raise HTTPException(status_code=400, detail="Not a template")

    today = datetime.utcnow().strftime('%-d %b')
    parts = [template.name]
    if data.property_id:
        from app.models.property import Property
        prop = db.query(Property).filter(Property.id == data.property_id).first()
        if prop:
            parts.append(prop.name)
    if data.unit_name:
        parts.append(data.unit_name)
    if data.tenant_name:
        parts.append(data.tenant_name)
    parts.append(today)
    name = ' · '.join(parts)

    instance = Checklist(
        organisation_id=current_user.organisation_id,
        name=name,
        checklist_type=template.checklist_type,
        is_template=False,
        property_id=data.property_id,
        unit_name=data.unit_name,
        tenant_name=data.tenant_name,
    )
    db.add(instance)
    db.flush()
    for item in template.items:
        db.add(ChecklistItem(checklist_id=instance.id, label=item.label, position=item.position))
    db.commit()
    db.refresh(instance)
    return _out(instance)


@router.get("")
def list_checklists(
    checklist_type: Optional[str] = None,
    property_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Checklist).filter(
        Checklist.organisation_id == current_user.organisation_id,
        Checklist.is_template == False,
    )
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
    c = Checklist(
        organisation_id=current_user.organisation_id,
        name=data.name,
        checklist_type=data.checklist_type,
        is_template=data.is_template,
        property_id=data.property_id,
        unit_name=data.unit_name,
        tenant_name=data.tenant_name,
    )
    db.add(c)
    db.flush()
    for i, label in enumerate(data.items or []):
        db.add(ChecklistItem(checklist_id=c.id, label=label, position=i))
    db.commit()
    db.refresh(c)
    return _out(c)


@router.get("/{checklist_id}")
def get_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _out(_get_or_404(checklist_id, current_user.organisation_id, db))


@router.put("/{checklist_id}")
def update_checklist(
    checklist_id: int,
    data: ChecklistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = _get_or_404(checklist_id, current_user.organisation_id, db)
    if data.name is not None:
        c.name = data.name
    if data.property_id is not None:
        c.property_id = data.property_id
    if data.unit_name is not None:
        c.unit_name = data.unit_name
    if data.tenant_name is not None:
        c.tenant_name = data.tenant_name
    db.commit()
    db.refresh(c)
    return _out(c)


@router.delete("/{checklist_id}")
def delete_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = _get_or_404(checklist_id, current_user.organisation_id, db)
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
    _get_or_404(checklist_id, current_user.organisation_id, db)
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


@router.put("/{checklist_id}/items/{item_id}")
def rename_item(
    checklist_id: int,
    item_id: int,
    data: ItemRename,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_or_404(checklist_id, current_user.organisation_id, db)
    item = db.query(ChecklistItem).filter(
        ChecklistItem.id == item_id,
        ChecklistItem.checklist_id == checklist_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.label = data.label
    db.commit()
    return _item_out(item)


@router.post("/{checklist_id}/items")
def add_item(
    checklist_id: int,
    data: ItemAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = _get_or_404(checklist_id, current_user.organisation_id, db)
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
    _get_or_404(checklist_id, current_user.organisation_id, db)
    item = db.query(ChecklistItem).filter(
        ChecklistItem.id == item_id,
        ChecklistItem.checklist_id == checklist_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
