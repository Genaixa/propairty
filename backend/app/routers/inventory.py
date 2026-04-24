import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
import os

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.inventory import Inventory, InventoryRoom, InventoryItem, DEFAULT_ROOMS, CONDITIONS
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.models.tenant import Tenant
from app.models.organisation import Organisation
from app.models.upload import UploadedFile

router = APIRouter(prefix="/api/inventory", tags=["inventory"])
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
CONDITION_RANK = {"excellent": 4, "good": 3, "fair": 2, "poor": 1, "missing": 0, "n/a": None}


# --- Schemas ---

class ItemIn(BaseModel):
    item_name: str
    condition: Optional[str] = None
    notes: Optional[str] = None
    order: int = 0

class RoomIn(BaseModel):
    room_name: str
    notes: Optional[str] = None
    order: int = 0
    items: List[ItemIn] = []

class InventoryCreate(BaseModel):
    lease_id: int
    inv_type: str                       # check_in | check_out
    inv_date: date
    conducted_by: Optional[str] = None
    tenant_present: bool = True
    overall_notes: Optional[str] = None
    meter_electric: Optional[str] = None
    meter_gas: Optional[str] = None
    meter_water: Optional[str] = None
    keys_handed: Optional[str] = None
    rooms: List[RoomIn] = []


# --- Helpers ---

def _get_lease(lease_id, org_id, db):
    lease = (
        db.query(Lease).join(Unit).join(Property)
        .filter(Lease.id == lease_id, Property.organisation_id == org_id)
        .first()
    )
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    return lease


def _inv_out(inv: Inventory, db: Session, include_rooms: bool = True) -> dict:
    lease = inv.lease
    unit = lease.unit if lease else None
    prop = unit.property if unit else None
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
    result = {
        "id": inv.id,
        "lease_id": inv.lease_id,
        "inv_type": inv.inv_type,
        "inv_date": inv.inv_date.isoformat() if inv.inv_date else None,
        "conducted_by": inv.conducted_by,
        "tenant_present": inv.tenant_present,
        "overall_notes": inv.overall_notes,
        "meter_electric": inv.meter_electric,
        "meter_gas": inv.meter_gas,
        "meter_water": inv.meter_water,
        "keys_handed": inv.keys_handed,
        "tenant_name": tenant.full_name if tenant else "—",
        "tenant_id": tenant.id if tenant else None,
        "unit": f"{prop.name} · {unit.name}" if prop and unit else "—",
        "unit_id": unit.id if unit else None,
        "property_id": prop.id if prop else None,
        "property_address": f"{prop.address_line1}, {prop.city}" if prop else "—",
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }
    if include_rooms:
        result["rooms"] = [
            {
                "id": r.id,
                "room_name": r.room_name,
                "order": r.order,
                "notes": r.notes,
                "items": [
                    {"id": i.id, "item_name": i.item_name, "condition": i.condition, "notes": i.notes, "order": i.order}
                    for i in r.items
                ],
                "photos": [
                    {"id": p.id, "url": f"/uploads/{p.filename}", "original_name": p.original_name}
                    for p in db.query(UploadedFile).filter(
                        UploadedFile.entity_type == "inventory_room",
                        UploadedFile.entity_id == r.id,
                    ).all()
                ],
            }
            for r in inv.rooms
        ]
    return result


def _build_comparison(check_in: Inventory, check_out: Inventory) -> list:
    """Build room+item comparison between check-in and check-out."""
    out_rooms = {r.room_name: r for r in check_out.rooms}
    result = []
    for in_room in check_in.rooms:
        out_room = out_rooms.get(in_room.room_name)
        out_items = {i.item_name: i for i in out_room.items} if out_room else {}
        items = []
        for in_item in in_room.items:
            out_item = out_items.get(in_item.item_name)
            in_rank = CONDITION_RANK.get(in_item.condition)
            out_rank = CONDITION_RANK.get(out_item.condition) if out_item else None
            changed = (in_rank is not None and out_rank is not None and out_rank < in_rank)
            improved = (in_rank is not None and out_rank is not None and out_rank > in_rank)
            items.append({
                "item_name": in_item.item_name,
                "condition": in_item.condition,
                "out_condition": out_item.condition if out_item else None,
                "notes": out_item.notes if out_item else in_item.notes,
                "changed": changed,
                "improved": improved,
                "order": in_item.order,
            })
        result.append({
            "room_name": in_room.room_name,
            "notes": in_room.notes,
            "order": in_room.order,
            "items": items,
        })
    return result


# --- Endpoints ---

@router.get("/default-rooms")
def get_default_rooms():
    return DEFAULT_ROOMS


@router.get("/leases")
def leases_for_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    leases = (
        db.query(Lease).join(Unit).join(Property)
        .filter(Property.organisation_id == current_user.organisation_id)
        .all()
    )
    result = []
    for l in leases:
        unit = l.unit
        prop = unit.property if unit else None
        tenant = db.query(Tenant).filter(Tenant.id == l.tenant_id).first()
        existing = db.query(Inventory).filter(Inventory.lease_id == l.id).all()
        result.append({
            "id": l.id,
            "tenant_name": tenant.full_name if tenant else "—",
            "unit": f"{prop.name} · {unit.name}" if prop and unit else "—",
            "status": l.status,
            "has_check_in": any(i.inv_type == "check_in" for i in existing),
            "has_check_out": any(i.inv_type == "check_out" for i in existing),
        })
    return result


@router.get("")
def list_inventories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invs = (
        db.query(Inventory)
        .filter(
            Inventory.organisation_id == current_user.organisation_id,
            Inventory.status == "confirmed",
        )
        .order_by(Inventory.inv_date.desc())
        .all()
    )
    return [_inv_out(i, db, include_rooms=False) for i in invs]


@router.get("/compare/{lease_id}")
def compare_inventories(
    lease_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_lease(lease_id, current_user.organisation_id, db)
    check_in = db.query(Inventory).filter(
        Inventory.lease_id == lease_id, Inventory.inv_type == "check_in"
    ).order_by(Inventory.inv_date.desc()).first()
    check_out = db.query(Inventory).filter(
        Inventory.lease_id == lease_id, Inventory.inv_type == "check_out"
    ).order_by(Inventory.inv_date.desc()).first()

    if not check_in:
        raise HTTPException(status_code=404, detail="No check-in inventory found for this lease")

    comparison_rooms = _build_comparison(check_in, check_out) if check_out else None
    declined = []
    if comparison_rooms:
        for r in comparison_rooms:
            for i in r["items"]:
                if i["changed"]:
                    declined.append({
                        "room": r["room_name"],
                        "item": i["item_name"],
                        "in_condition": i["condition"],
                        "out_condition": i["out_condition"],
                        "notes": i["notes"],
                    })

    return {
        "check_in": _inv_out(check_in, db) if check_in else None,
        "check_out": _inv_out(check_out, db) if check_out else None,
        "comparison": comparison_rooms,
        "declined_items": declined,
        "declined_count": len(declined),
    }


@router.get("/{inv_id}")
def get_inventory(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Inventory).filter(
        Inventory.id == inv_id,
        Inventory.organisation_id == current_user.organisation_id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory not found")
    return _inv_out(inv, db)


@router.post("")
def create_inventory(
    data: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_lease(data.lease_id, current_user.organisation_id, db)

    inv = Inventory(
        organisation_id=current_user.organisation_id,
        lease_id=data.lease_id,
        inv_type=data.inv_type,
        inv_date=data.inv_date,
        conducted_by=data.conducted_by,
        tenant_present=data.tenant_present,
        overall_notes=data.overall_notes,
        meter_electric=data.meter_electric,
        meter_gas=data.meter_gas,
        meter_water=data.meter_water,
        keys_handed=data.keys_handed,
    )
    db.add(inv)
    db.flush()

    for room_data in data.rooms:
        room = InventoryRoom(
            inventory_id=inv.id,
            room_name=room_data.room_name,
            order=room_data.order,
            notes=room_data.notes,
        )
        db.add(room)
        db.flush()
        for item_data in room_data.items:
            db.add(InventoryItem(
                room_id=room.id,
                item_name=item_data.item_name,
                condition=item_data.condition,
                notes=item_data.notes,
                order=item_data.order,
            ))

    db.commit()
    db.refresh(inv)
    return _inv_out(inv, db)


@router.get("/drafts")
def list_drafts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return draft inventories created via the Telegram bot."""
    drafts = (
        db.query(Inventory)
        .filter(
            Inventory.organisation_id == current_user.organisation_id,
            Inventory.status == "draft",
        )
        .order_by(Inventory.created_at.desc())
        .all()
    )
    return [_inv_out(i, db) for i in drafts]


@router.post("/{inv_id}/confirm")
def confirm_draft(
    inv_id: int,
    data: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm a Telegram draft: replace its rooms with the reviewed data
    and mark it as confirmed.
    """
    inv = db.query(Inventory).filter(
        Inventory.id == inv_id,
        Inventory.organisation_id == current_user.organisation_id,
        Inventory.status == "draft",
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Update header fields
    inv.inv_type = data.inv_type
    inv.inv_date = data.inv_date
    inv.conducted_by = data.conducted_by
    inv.tenant_present = data.tenant_present
    inv.overall_notes = data.overall_notes
    inv.meter_electric = data.meter_electric
    inv.meter_gas = data.meter_gas
    inv.meter_water = data.meter_water
    inv.keys_handed = data.keys_handed
    inv.status = "confirmed"

    # Replace rooms
    for room in inv.rooms:
        db.delete(room)
    db.flush()

    for ri, room_data in enumerate(data.rooms):
        room = InventoryRoom(
            inventory_id=inv.id,
            room_name=room_data.room_name,
            order=ri,
            notes=room_data.notes,
        )
        db.add(room)
        db.flush()
        for ii, item_data in enumerate(room_data.items):
            db.add(InventoryItem(
                room_id=room.id,
                item_name=item_data.item_name,
                condition=item_data.condition,
                notes=item_data.notes,
                order=ii,
            ))

    db.commit()
    db.refresh(inv)
    return _inv_out(inv, db)


@router.delete("/{inv_id}")
def delete_inventory(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Inventory).filter(
        Inventory.id == inv_id,
        Inventory.organisation_id == current_user.organisation_id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(inv)
    db.commit()
    return {"ok": True}


@router.get("/{inv_id}/report")
def inventory_report_pdf(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Inventory).filter(
        Inventory.id == inv_id,
        Inventory.organisation_id == current_user.organisation_id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")

    lease = inv.lease
    unit = lease.unit if lease else None
    prop = unit.property if unit else None
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()

    rooms_data = [
        {
            "room_name": r.room_name,
            "notes": r.notes,
            "order": r.order,
            "items": [
                {"item_name": i.item_name, "condition": i.condition, "notes": i.notes, "order": i.order}
                for i in r.items
            ],
        }
        for r in inv.rooms
    ]

    ctx = {
        "org_name": org.name if org else "PropAIrty",
        "today": date.today().strftime("%-d %B %Y"),
        "ref": f"INV-{inv.id:04d}",
        "inv_type_label": "Check-In Inventory" if inv.inv_type == "check_in" else "Check-Out Inventory",
        "inv_date": inv.inv_date.strftime("%-d %B %Y") if inv.inv_date else "—",
        "property_address": f"{prop.address_line1}, {prop.city}, {prop.postcode}" if prop else "—",
        "unit_name": unit.name if unit else "—",
        "tenant_name": tenant.full_name if tenant else "—",
        "conducted_by": inv.conducted_by,
        "tenant_present": inv.tenant_present,
        "overall_notes": inv.overall_notes,
        "meter_electric": inv.meter_electric,
        "meter_gas": inv.meter_gas,
        "meter_water": inv.meter_water,
        "keys_handed": inv.keys_handed,
        "rooms": rooms_data,
        "is_comparison": False,
        "declined_items": [],
    }

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("documents/inventory_report.html")
    pdf = HTML(string=template.render(**ctx)).write_pdf()
    label = "CheckIn" if inv.inv_type == "check_in" else "CheckOut"
    filename = f"Inventory_{label}_{tenant.full_name.replace(' ', '_') if tenant else 'tenant'}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/compare/{lease_id}/report")
def comparison_report_pdf(
    lease_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lease = _get_lease(lease_id, current_user.organisation_id, db)
    check_in = db.query(Inventory).filter(
        Inventory.lease_id == lease_id, Inventory.inv_type == "check_in"
    ).order_by(Inventory.inv_date.desc()).first()
    check_out = db.query(Inventory).filter(
        Inventory.lease_id == lease_id, Inventory.inv_type == "check_out"
    ).order_by(Inventory.inv_date.desc()).first()

    if not check_in or not check_out:
        raise HTTPException(status_code=404, detail="Both check-in and check-out inventories required")

    unit = lease.unit
    prop = unit.property if unit else None
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()

    comparison_rooms = _build_comparison(check_in, check_out)
    declined = [
        {"room": r["room_name"], "item": i["item_name"],
         "in_condition": i["condition"], "out_condition": i["out_condition"], "notes": i["notes"]}
        for r in comparison_rooms for i in r["items"] if i["changed"]
    ]

    ctx = {
        "org_name": org.name if org else "PropAIrty",
        "today": date.today().strftime("%-d %B %Y"),
        "ref": f"INV-CMP-{lease_id:04d}",
        "inv_type_label": "Check-In vs Check-Out Comparison",
        "inv_date": f"{check_in.inv_date.strftime('%-d %b %Y')} → {check_out.inv_date.strftime('%-d %b %Y')}",
        "property_address": f"{prop.address_line1}, {prop.city}, {prop.postcode}" if prop else "—",
        "unit_name": unit.name if unit else "—",
        "tenant_name": tenant.full_name if tenant else "—",
        "conducted_by": check_out.conducted_by,
        "tenant_present": check_out.tenant_present,
        "overall_notes": check_out.overall_notes,
        "meter_electric": check_out.meter_electric,
        "meter_gas": check_out.meter_gas,
        "meter_water": check_out.meter_water,
        "keys_handed": check_out.keys_handed,
        "rooms": comparison_rooms,
        "is_comparison": True,
        "declined_items": declined,
    }

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("documents/inventory_report.html")
    pdf = HTML(string=template.render(**ctx)).write_pdf()
    filename = f"InventoryComparison_{tenant.full_name.replace(' ', '_') if tenant else 'tenant'}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
