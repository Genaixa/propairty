"""
Guided Telegram Inventory Bot
==============================
Agents use this bot on-site to capture inventories room-by-room via voice, text, or photos.

Session state machine:
  awaiting_lease  → agent identifies the property/tenant
  awaiting_type   → ask check_in or check_out
  room_N          → guided room-by-room capture (DB records created immediately)
  awaiting_meters → meter readings + keys
  done            → draft confirmed, link sent

Option B architecture: InventoryRoom records are created in the DB as soon as the bot
enters each room state, so photos can be attached to them live via the upload system.
"""
import os
import re
import json
import uuid
import tempfile
import anthropic

from datetime import date
from pathlib import Path
from sqlalchemy.orm import Session

from app.config import settings
from app.models.telegram_session import TelegramInventorySession
from app.models.inventory import Inventory, InventoryRoom, InventoryItem, DEFAULT_ROOMS
from app.models.upload import UploadedFile
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.models.tenant import Tenant
from app.models.organisation import Organisation

UPLOAD_DIR = Path("/root/propairty/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ── Session helpers ───────────────────────────────────────────────────────────

def get_active_session(chat_id: str, org_id: int, db: Session):
    return (
        db.query(TelegramInventorySession)
        .filter(
            TelegramInventorySession.chat_id == chat_id,
            TelegramInventorySession.org_id == org_id,
            TelegramInventorySession.state != "done",
        )
        .order_by(TelegramInventorySession.created_at.desc())
        .first()
    )


def _find_leases(query: str, org_id: int, db: Session):
    """Score active leases against a free-text query."""
    words = [w for w in re.split(r"\W+", query.lower()) if len(w) > 2]
    leases = (
        db.query(Lease).join(Unit).join(Property)
        .filter(Property.organisation_id == org_id, Lease.status == "active")
        .all()
    )
    scored = []
    for lease in leases:
        unit = lease.unit
        prop = unit.property if unit else None
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        searchable = " ".join(filter(None, [
            prop.name if prop else "",
            prop.address_line1 if prop else "",
            getattr(prop, "address_line2", "") or "",
            prop.city if prop else "",
            prop.postcode if prop else "",
            unit.name if unit else "",
            tenant.full_name if tenant else "",
        ])).lower()
        score = sum(1 for w in words if w in searchable)
        if score > 0:
            scored.append((score, lease, tenant, unit, prop))
    scored.sort(key=lambda x: -x[0])
    return scored


def _build_room_plan(lease_id: int, inv_type: str, db: Session) -> list:
    """Build ordered list of rooms. For check-out, mirrors the existing check-in."""
    if inv_type == "check_out":
        check_in = (
            db.query(Inventory)
            .filter(
                Inventory.lease_id == lease_id,
                Inventory.inv_type == "check_in",
                Inventory.status == "confirmed",
            )
            .order_by(Inventory.inv_date.desc())
            .first()
        )
        if check_in and check_in.rooms:
            return [
                {
                    "room_name": r.room_name,
                    "expected_items": [i.item_name for i in r.items],
                    "check_in_items": [
                        {"item_name": i.item_name, "condition": i.condition}
                        for i in r.items
                    ],
                }
                for r in check_in.rooms
            ]
    return [
        {"room_name": name, "expected_items": items, "check_in_items": []}
        for name, items in DEFAULT_ROOMS.items()
    ]


def _room_question(room_entry: dict) -> str:
    items_list = "\n".join(f"  • {i}" for i in room_entry["expected_items"])
    msg = f"<b>{room_entry['room_name']}</b>\nItems to cover:\n{items_list}"
    if room_entry.get("check_in_items"):
        prev = "\n".join(
            f"  • {i['item_name']}: <i>{i['condition'] or 'not recorded'}</i>"
            for i in room_entry["check_in_items"]
        )
        msg += f"\n\n<i>At check-in:</i>\n{prev}"
    msg += "\n\nDescribe each item (voice, text, or photos). Say <b>next</b> when done with this room."
    return msg


# ── DB helpers ────────────────────────────────────────────────────────────────

def _ensure_draft_inventory(session: TelegramInventorySession, db: Session) -> Inventory:
    """Create the draft Inventory record if it doesn't exist yet."""
    if session.draft_inventory_id:
        return db.query(Inventory).filter(Inventory.id == session.draft_inventory_id).first()

    inv = Inventory(
        organisation_id=session.org_id,
        lease_id=session.lease_id,
        inv_type=session.inv_type,
        inv_date=date.today(),
        conducted_by=session.conducted_by,
        tenant_present=True,
        status="draft",
    )
    db.add(inv)
    db.flush()
    session.draft_inventory_id = inv.id
    db.commit()
    return inv


def _enter_room(session: TelegramInventorySession, n: int, db: Session) -> str:
    """
    Transition to room N: create the InventoryRoom DB record immediately
    so photos can be attached before the agent describes conditions.
    """
    plan = session.room_plan
    room_entry = plan[n]

    inv = _ensure_draft_inventory(session, db)

    room = InventoryRoom(
        inventory_id=inv.id,
        room_name=room_entry["room_name"],
        order=n,
    )
    db.add(room)
    db.flush()

    session.state = f"room_{n}"
    session.current_room_index = n
    session.current_room_db_id = room.id
    db.commit()

    return _room_question(room_entry)


def _save_room_items(room_id: int, room_entry: dict, description: str, db: Session):
    """Parse description with Claude and write InventoryItems to the existing room."""
    items = _parse_room(
        room_entry["room_name"],
        room_entry["expected_items"],
        description,
        room_entry.get("check_in_items"),
    )
    # Remove any previously parsed items for this room (e.g. agent re-described it)
    db.query(InventoryItem).filter(InventoryItem.room_id == room_id).delete()
    db.flush()
    for ii, item in enumerate(items):
        db.add(InventoryItem(
            room_id=room_id,
            item_name=item["item_name"],
            condition=item.get("condition"),
            notes=item.get("notes") or None,
            order=ii,
        ))
    db.commit()
    return items


def _save_photo(photo_bytes: bytes, ext: str, org_id: int, room_id: int, db: Session) -> UploadedFile:
    """Save a photo to disk and create an UploadedFile record attached to the room."""
    stored_name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(photo_bytes)
    record = UploadedFile(
        organisation_id=org_id,
        entity_type="inventory_room",
        entity_id=room_id,
        filename=stored_name,
        original_name=stored_name,
        mime_type="image/jpeg",
        file_size=len(photo_bytes),
        category="photo",
    )
    db.add(record)
    db.commit()
    return record


# ── Claude parsing ────────────────────────────────────────────────────────────

def _parse_room(room_name: str, expected_items: list, description: str,
                check_in_items: list = None) -> list:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return [{"item_name": it, "condition": "good", "notes": ""} for it in expected_items]

    checkin_ctx = ""
    if check_in_items:
        checkin_ctx = "\nAt check-in:\n" + "\n".join(
            f"- {i['item_name']}: {i['condition'] or 'not recorded'}" for i in check_in_items
        )

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system="You extract property inventory data. Return only valid JSON, no explanation.",
        messages=[{"role": "user", "content": f"""Room: {room_name}
Expected items: {', '.join(expected_items)}{checkin_ctx}

Agent description: "{description}"

Return a JSON array with ALL expected items:
[{{"item_name": "...", "condition": "excellent|good|fair|poor|missing|n/a", "notes": "..."}}]

Rules:
- Include EVERY expected item even if not mentioned (use "n/a")
- Conditions must be one of: excellent, good, fair, poor, missing, n/a
- Put specific damage/observation details in "notes", empty string otherwise
- If agent says "all good" or "fine" apply "good" to unmentioned items
- For check-out: if agent says "same as check-in" copy the check-in conditions"""}],
    )
    text = response.content[0].text.strip()
    if "```" in text:
        text = text.split("```json")[-1].split("```")[0].strip()
    return json.loads(text)


def _parse_meters(text: str) -> dict:
    result = {"meter_electric": None, "meter_gas": None, "meter_water": None, "keys_handed": None}
    t = text.lower()
    m = re.search(r"electric[:\s]+([0-9]+)", t)
    if m: result["meter_electric"] = m.group(1)
    m = re.search(r"gas[:\s]+([0-9]+)", t)
    if m: result["meter_gas"] = m.group(1)
    m = re.search(r"water[:\s]+([0-9]+)", t)
    if m: result["meter_water"] = m.group(1)
    m = re.search(r"keys?[:\s]+(.+?)(?:$|electric|gas|water)", t)
    if m: result["keys_handed"] = m.group(1).strip()
    return result


# ── Photo handler (called from webhook) ──────────────────────────────────────

async def handle_telegram_photo(chat_id: str, photo_bytes: bytes, ext: str,
                                 org: Organisation, db: Session) -> str:
    """Handle an inbound photo during an active inventory session."""
    session = get_active_session(chat_id, org.id, db)
    if not session:
        return None  # Not in an inventory session — ignore

    room_match = re.match(r"^room_(\d+)$", session.state)
    if not room_match:
        return "📷 Photos can be sent once you're describing a room."

    if not session.current_room_db_id:
        return "📷 Something went wrong — no active room. Try /cancel and restart."

    _save_photo(photo_bytes, ext, org.id, session.current_room_db_id, db)

    # Count total photos for this room
    count = db.query(UploadedFile).filter(
        UploadedFile.entity_type == "inventory_room",
        UploadedFile.entity_id == session.current_room_db_id,
    ).count()

    plan = session.room_plan
    n = int(room_match.group(1))
    room_name = plan[n]["room_name"]
    return f"📷 Photo saved for <b>{room_name}</b> ({count} photo{'s' if count > 1 else ''} total)\nSend more photos, describe the items, or say <b>next</b> to move on."


# ── Main message handler ──────────────────────────────────────────────────────

def handle_telegram_message(chat_id: str, text: str, org: Organisation, db: Session) -> str:
    text = text.strip()
    t_lower = text.lower()

    # Cancel anywhere
    if t_lower in ("cancel", "/cancel", "quit", "/quit", "stop", "/stop"):
        session = get_active_session(chat_id, org.id, db)
        if session:
            # Clean up draft inventory if nothing was confirmed yet
            if session.draft_inventory_id:
                inv = db.query(Inventory).filter(Inventory.id == session.draft_inventory_id).first()
                if inv and inv.status == "draft":
                    db.delete(inv)
            db.delete(session)
            db.commit()
        return "Inventory session cancelled."

    session = get_active_session(chat_id, org.id, db)

    # ── No active session ─────────────────────────────────────────────────────
    if not session:
        cmd = re.match(r"^/inventory\s+(\d+)(?:\s+(check_?in|check_?out|in|out))?", t_lower)
        if cmd:
            lease_id = int(cmd.group(1))
            inv_type_raw = cmd.group(2) or ""
            inv_type = "check_in" if "in" in inv_type_raw else ("check_out" if "out" in inv_type_raw else None)
            lease = (
                db.query(Lease).join(Unit).join(Property)
                .filter(Lease.id == lease_id, Property.organisation_id == org.id)
                .first()
            )
            if not lease:
                return f"Lease #{lease_id} not found."
            return _start_session(chat_id, org.id, lease, inv_type, db)

        if any(kw in t_lower for kw in ("inventory", "check in", "check out", "check-in", "check-out",
                                         "i'm at", "im at", "at property", "flat", "street",
                                         "avenue", "road", "lane", "house", "apartment")):
            matches = _find_leases(text, org.id, db)
            if not matches:
                return (
                    "I couldn't find a matching property.\n\n"
                    "Try: <code>/inventory {lease_id} check_in</code>\n"
                    "or describe the address more specifically."
                )
            if len(matches) == 1 or matches[0][0] > matches[1][0]:
                _, lease, *_ = matches[0]
                return _start_session(chat_id, org.id, lease, None, db)
            else:
                options = "\n".join(
                    f"{i+1}. {prop.name} · {unit.name} — {tenant.full_name}"
                    for i, (_, _, tenant, unit, prop) in enumerate(matches[:5])
                )
                session = TelegramInventorySession(
                    chat_id=chat_id, org_id=org.id, state="awaiting_lease",
                    room_plan=[m[1].id for m in matches[:5]],
                )
                db.add(session)
                db.commit()
                return f"Found multiple properties. Which one?\n\n{options}\n\nReply with the number."

        return (
            "Send me the property address or tenant name to start an inventory.\n\n"
            "Or: <code>/inventory {lease_id} check_in</code>"
        )

    # ── awaiting_lease ────────────────────────────────────────────────────────
    if session.state == "awaiting_lease":
        lease_ids = session.room_plan if isinstance(session.room_plan, list) else []
        if text.isdigit() and 1 <= int(text) <= len(lease_ids):
            lease = db.query(Lease).filter(Lease.id == lease_ids[int(text) - 1]).first()
            if lease:
                session.lease_id = lease.id
                session.room_plan = []
                session.state = "awaiting_type"
                db.commit()
                unit = lease.unit
                prop = unit.property if unit else None
                tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
                return (
                    f"<b>{prop.name if prop else ''} · {unit.name if unit else ''}</b> — {tenant.full_name if tenant else '—'}\n\n"
                    "Is this a <b>check-in</b> or <b>check-out</b>?"
                )
        return "Please reply with the number from the list above."

    # ── awaiting_type ─────────────────────────────────────────────────────────
    if session.state == "awaiting_type":
        if any(x in t_lower for x in ("check in", "checkin", "check-in", "in", "1")):
            inv_type = "check_in"
        elif any(x in t_lower for x in ("check out", "checkout", "check-out", "out", "2")):
            inv_type = "check_out"
        else:
            return "Please reply <b>check in</b> or <b>check out</b>."

        session.inv_type = inv_type
        session.room_plan = _build_room_plan(session.lease_id, inv_type, db)
        session.current_room_index = 0
        db.commit()
        type_label = "Check-In" if inv_type == "check_in" else "Check-Out"
        return f"Starting <b>{type_label}</b>. I'll guide you room by room.\n\n" + _enter_room(session, 0, db)

    # ── room_N ────────────────────────────────────────────────────────────────
    room_match = re.match(r"^room_(\d+)$", session.state)
    if room_match:
        n = int(room_match.group(1))
        plan = session.room_plan
        room_entry = plan[n]

        # "next" / "done" / "skip" → move to next room without parsing (photos-only room)
        if t_lower in ("next", "done", "skip", "move on", "next room"):
            return _advance_room(session, n, plan, room_entry, items=None, db=db)

        # Parse room description
        try:
            items = _save_room_items(session.current_room_db_id, room_entry, text, db)
        except Exception as e:
            return f"Sorry, I had trouble parsing that. Try again or say <b>next</b> to skip.\n<i>{e}</i>"

        return _advance_room(session, n, plan, room_entry, items, db)

    # ── awaiting_meters ───────────────────────────────────────────────────────
    if session.state == "awaiting_meters":
        if t_lower not in ("skip", "none", "n/a", "na"):
            meters = _parse_meters(text)
            inv = db.query(Inventory).filter(Inventory.id == session.draft_inventory_id).first()
            if inv:
                inv.meter_electric = meters["meter_electric"]
                inv.meter_gas = meters["meter_gas"]
                inv.meter_water = meters["meter_water"]
                inv.keys_handed = meters["keys_handed"]
                db.commit()

        session.state = "done"
        db.commit()

        return _done_message(session, db)

    # ── done ──────────────────────────────────────────────────────────────────
    if session.state == "done":
        return (
            "Your inventory draft is already saved.\n"
            "Review it at <b>propairty.co.uk/inventory</b> → Telegram Drafts\n\n"
            "To start a new inventory, send a property address or /inventory command."
        )

    return "Unexpected state. Try /cancel and start again."


# ── Helpers ───────────────────────────────────────────────────────────────────

def _advance_room(session, n, plan, room_entry, items, db):
    """Build summary reply and advance to next room or meters."""
    photo_count = db.query(UploadedFile).filter(
        UploadedFile.entity_type == "inventory_room",
        UploadedFile.entity_id == session.current_room_db_id,
    ).count() if session.current_room_db_id else 0

    if items:
        filled = [i for i in items if i.get("condition") and i["condition"] != "n/a"]
        cond_summary = ", ".join(f"{i['item_name']}: {i['condition']}" for i in filled)
        reply = f"✓ <b>{room_entry['room_name']}</b> — {len(filled)} items"
        if photo_count:
            reply += f", {photo_count} photo{'s' if photo_count > 1 else ''}"
        reply += f"\n<i>{cond_summary}</i>\n\n"
    else:
        reply = f"✓ <b>{room_entry['room_name']}</b>"
        if photo_count:
            reply += f" — {photo_count} photo{'s' if photo_count > 1 else ''}"
        reply += "\n\n"

    next_n = n + 1
    if next_n < len(plan):
        return reply + _enter_room(session, next_n, db)
    else:
        session.state = "awaiting_meters"
        db.commit()
        return (
            reply
            + "All rooms done! 🏠\n\n"
            "Finally: <b>meter readings and keys</b>?\n"
            "e.g. <i>electric 04521, gas 03847, water 00123, keys 2 front door 1 postbox</i>\n\n"
            "Or reply <b>skip</b>."
        )


def _done_message(session, db):
    type_label = "Check-In" if session.inv_type == "check_in" else "Check-Out"
    lease = db.query(Lease).filter(Lease.id == session.lease_id).first()
    unit = lease.unit if lease else None
    prop = unit.property if unit else None
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
    return (
        f"✅ <b>{type_label} draft saved!</b>\n"
        f"{prop.name if prop else ''} · {unit.name if unit else ''} — {tenant.full_name if tenant else ''}\n\n"
        "Review and confirm at:\n"
        "<b>propairty.co.uk/inventory</b> → Telegram Drafts"
    )


def _start_session(chat_id, org_id, lease, inv_type, db):
    unit = lease.unit
    prop = unit.property if unit else None
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
    header = (
        f"<b>{prop.name if prop else 'Property'} · {unit.name if unit else ''}</b>\n"
        f"Tenant: {tenant.full_name if tenant else '—'}\n\n"
    )
    if inv_type:
        plan = _build_room_plan(lease.id, inv_type, db)
        session = TelegramInventorySession(
            chat_id=chat_id, org_id=org_id, lease_id=lease.id,
            inv_type=inv_type, state="awaiting_type",  # will be updated in _enter_room
            room_plan=plan, current_room_index=0,
        )
        db.add(session)
        db.flush()
        # Immediately set type and enter first room
        session.inv_type = inv_type
        type_label = "Check-In" if inv_type == "check_in" else "Check-Out"
        first_room_msg = _enter_room(session, 0, db)
        return header + f"Starting <b>{type_label}</b>.\n\n" + first_room_msg
    else:
        session = TelegramInventorySession(
            chat_id=chat_id, org_id=org_id, lease_id=lease.id, state="awaiting_type",
        )
        db.add(session)
        db.commit()
        return header + "Is this a <b>check-in</b> or <b>check-out</b>?\nReply: <b>check in</b> or <b>check out</b>"
