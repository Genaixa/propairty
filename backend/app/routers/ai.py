import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from openai import OpenAI

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app import ai_tools
from app.config import settings

router = APIRouter(prefix="/api/ai", tags=["ai"])

SYSTEM_PROMPT = """You are PropAIrty Assistant, an expert AI built into PropAIrty — a UK property management platform.

You help letting agents and landlords manage their portfolio. You have live access to their data via tools.
Always call the relevant tool to get live data before answering. Never make up numbers.

Your capabilities:
- Answer questions about their portfolio, properties, tenants, leases, maintenance
- Create maintenance requests
- Find leases expiring soon and flag arrears risks
- Draft professional UK-standard letters (rent reminders, Section 8/21 notices, inspection notices, lease renewal offers)

Always address letters formally. Sign off as "PropAIrty Management".
Be concise and helpful. Answer directly — do not narrate your reasoning or mention tools, data retrieval, or internal steps. Just give the answer.
If a name, number, or detail is in the data above, state it exactly. Never say information is unavailable if it is present in the data. Never invent or guess contact details.

CRITICAL — listing items from tool results: When a tool returns a list, reproduce EVERY item exactly as returned. Do not skip, merge, duplicate, or reorder items. Do not substitute one item's title, location, or details for another's. Copy each field (id, title, property/unit, priority, status) verbatim from the tool response.

IMPORTANT — sending emails: You can only send emails using the send_arrears_reminder tool. Do not claim to have sent anything unless that tool returned success=true. If asked to send a reminder, call the tool and report the result exactly.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_stats",
            "description": "Get portfolio overview: properties, units, occupancy rate, rent roll, open maintenance issues.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_properties",
            "description": "List all properties with their units, addresses, rents and occupancy status.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_tenants",
            "description": "List tenants, optionally filtered by name. Returns current unit and active lease.",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Name search filter"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_leases",
            "description": "List leases filtered by status or find leases expiring within N days.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["active", "expired", "terminated"]},
                    "expiring_within_days": {"type": "integer", "description": "Find leases expiring within this many days"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_maintenance",
            "description": "List maintenance requests, optionally filtered by status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["open", "in_progress", "completed"]}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_maintenance_request",
            "description": "Create a new maintenance request for a unit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "unit_id": {"type": "integer"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                    "reported_by": {"type": "string"}
                },
                "required": ["unit_id", "title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_compliance",
            "description": "List compliance certificates (Gas Safety, EPC, EICR, Fire Risk, Legionella). Filter by status: valid, expiring_soon, expired.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["valid", "expiring_soon", "expired"]}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_arrears",
            "description": "List all tenants in arrears — overdue or partial rent payments. Shows amount owed, days overdue, contact details.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "draft_letter",
            "description": "Get tenant/lease context to draft a letter. Types: rent_reminder, section_8, section_21, inspection_notice, lease_renewal, welcome_letter, arrears_warning.",
            "parameters": {
                "type": "object",
                "properties": {
                    "letter_type": {"type": "string"},
                    "tenant_id": {"type": "integer"},
                    "lease_id": {"type": "integer"},
                    "custom_notes": {"type": "string"}
                },
                "required": ["letter_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "render_chart",
            "description": "Render a chart to visualise data. Use whenever the user asks about trends, comparisons, or anything that benefits from a visual. Supports bar, line, and pie charts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["bar", "line", "pie"], "description": "Chart type"},
                    "title": {"type": "string", "description": "Chart title"},
                    "labels": {"type": "array", "items": {"type": "string"}, "description": "X-axis labels or pie segment names"},
                    "datasets": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "data": {"type": "array", "items": {"type": "number"}}
                            },
                            "required": ["label", "data"]
                        },
                        "description": "Data series"
                    }
                },
                "required": ["type", "title", "labels", "datasets"]
            }
        }
    }
]

# Anthropic-format tools (converted from TOOLS above)
ANTHROPIC_TOOLS = [
    {
        "name": t["function"]["name"],
        "description": t["function"]["description"],
        "input_schema": t["function"]["parameters"],
    }
    for t in TOOLS
]

def _render_chart_tool(db, org_id, **kwargs):
    return kwargs  # spec passed through; frontend renders it

TOOL_FN_MAP = {
    "get_dashboard_stats": ai_tools.get_dashboard_stats,
    "list_properties": ai_tools.list_properties,
    "list_tenants": ai_tools.list_tenants,
    "list_leases": ai_tools.list_leases,
    "list_maintenance": ai_tools.list_maintenance,
    "create_maintenance_request": ai_tools.create_maintenance_request,
    "list_compliance": ai_tools.list_compliance,
    "list_arrears": ai_tools.list_arrears,
    "draft_letter": ai_tools.draft_letter,
    "send_arrears_reminder": ai_tools.send_arrears_reminder,
    "render_chart": _render_chart_tool,
}


def get_openai_client():
    """Return fastest available OpenAI-compatible client."""
    # 1. Groq — free, sub-second inference
    if settings.groq_api_key:
        return OpenAI(base_url="https://api.groq.com/openai/v1", api_key=settings.groq_api_key), "llama-3.1-8b-instant"

    # 2. Mistral API
    if settings.mistral_api_key:
        return OpenAI(base_url="https://api.mistral.ai/v1", api_key=settings.mistral_api_key), "mistral-small-latest"

    # 3. Ollama local (slow on CPU — last resort)
    try:
        import httpx
        r = httpx.get("http://localhost:11434/api/tags", timeout=2)
        if r.status_code == 200:
            return OpenAI(base_url="http://localhost:11434/v1", api_key="ollama"), "llama3.2:3b"
    except Exception:
        pass

    return None, None


def _build_context_prompt(db: Session, org_id: int) -> str:
    """Build a compact plain-text context from live portfolio data."""
    from datetime import date
    from app.models.landlord import Landlord
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    s = ai_tools.get_dashboard_stats(db=db, org_id=org_id)
    lines = [
        "=== LIVE PORTFOLIO DATA ===",
        f"Overview: {s['properties']} properties, {s['units']} units, {s['occupied']} occupied ({s['occupancy_rate']}), {s['vacant']} vacant, {s['tenants']} tenants, {s['active_leases']} active leases, rent roll {s['monthly_rent_roll']}, {s['open_maintenance']} open maintenance jobs.",
        "",
    ]

    landlords = db.query(Landlord).filter(Landlord.organisation_id == org_id).all()
    if landlords:
        lines.append("LANDLORDS:")
        for ll in landlords:
            props = ", ".join(p.name for p in ll.properties) or "no properties assigned"
            lines.append(f"  {ll.full_name} — {ll.email}{' · ' + ll.phone if ll.phone else ''} — properties: {props}")
        lines.append("")

    lines.append("PROPERTIES:")
    for p in ai_tools.list_properties(db=db, org_id=org_id):
        lines.append(f"  {p['name']} ({p['type']}) — {p['address']}")
        for u in p['units']:
            lines.append(f"    Unit {u['name']}: {u['bedrooms']}bed, {u['rent']}, {u['status']}")

    lines.append("\nTENANTS & LEASES:")
    for l in ai_tools.list_leases(db=db, org_id=org_id):
        email = f", email: {l['tenant_email']}" if l.get('tenant_email') else ""
        lines.append(f"  {l['tenant']} — {l['unit']} — {l['rent']} — lease {l['start']} to {l['end']} ({l['status']}){email}")
    for t in ai_tools.list_tenants(db=db, org_id=org_id):
        if t.get('phone') or t.get('email'):
            lines.append(f"  {t['name']} contact: phone {t.get('phone','—')}, email {t.get('email','—')}")

    maint = ai_tools.list_maintenance(db=db, org_id=org_id)
    open_m = [m for m in maint if m['status'] in ('open', 'in_progress')]
    if open_m:
        lines.append(f"\nOPEN MAINTENANCE ({len(open_m)} jobs — reproduce ALL of them exactly):")
        for i, m in enumerate(open_m, 1):
            lines.append(f"  {i}. id={m['id']} [{m['priority']}] {m['title']} — {m['unit']} ({m['status']})")

    arrears = ai_tools.list_arrears(db=db, org_id=org_id)
    if arrears['count']:
        lines.append(f"\nARREARS: {arrears['count']} tenants owe {arrears['total_owed']} total.")
        for a in arrears['arrears']:
            lines.append(f"  {a['tenant']} — {a['unit']} — owes {a['amount_owed']} ({a['days_overdue']}d overdue)")
    else:
        lines.append("\nARREARS: None. All rent payments are up to date. Do NOT invent arrears from pending future payments.")

    # Payment snapshot — pending = future scheduled, not overdue
    from app.models.payment import RentPayment as _RP
    from sqlalchemy import func as _func
    today_date = date.today()
    paid_this_month = db.query(_RP).join(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        _RP.status == 'paid',
        _RP.due_date >= today_date.replace(day=1)
    ).count()
    future_pending = db.query(_RP).join(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        _RP.status == 'pending',
        _RP.due_date > today_date
    ).count()
    lines.append(f"PAYMENT SNAPSHOT: {paid_this_month} payments collected this month. {future_pending} future scheduled payments (not arrears).")

    comp = ai_tools.list_compliance(db=db, org_id=org_id)
    if comp['expired'] or comp['expiring_soon']:
        lines.append(f"\nCOMPLIANCE: {comp['expired']} expired, {comp['expiring_soon']} expiring soon.")
        for c in comp['certificates']:
            if c['status'] != 'valid':
                lines.append(f"  [{c['status']}] {c['cert_type']} — {c['property']} — expires {c['expiry_date']}")

    from app.models.deposit import TenancyDeposit
    from app.models.lease import Lease
    from app.models.tenant import Tenant
    from app.models.unit import Unit
    from app.models.property import Property
    deposits = (
        db.query(TenancyDeposit, Tenant, Property, Unit)
        .join(Lease, Lease.id == TenancyDeposit.lease_id)
        .join(Tenant, Tenant.id == Lease.tenant_id)
        .join(Unit, Unit.id == Lease.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .filter(Property.organisation_id == org_id)
        .all()
    )
    if deposits:
        lines.append("\nDEPOSITS:")
        for d, tenant, prop, unit in deposits:
            lines.append(f"  {tenant.full_name} — {prop.name} · {unit.name} — £{d.amount:.2f} ({d.scheme}, ref: {d.scheme_reference or '—'}) — status: {d.status}")

    from app.models.notice import LegalNotice
    from app.models.payment import RentPayment
    from app.models.contractor import Contractor
    from app.models.renewal import LeaseRenewal

    # Legal notices
    notices = db.query(LegalNotice).filter(LegalNotice.organisation_id == org_id).order_by(LegalNotice.served_date.desc()).all()
    if notices:
        lines.append("\nLEGAL NOTICES:")
        for n in notices:
            lease = db.query(Lease).filter(Lease.id == n.lease_id).first()
            tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
            unit = db.query(Unit).filter(Unit.id == lease.unit_id).first() if lease else None
            prop = db.query(Property).filter(Property.id == unit.property_id).first() if unit else None
            label = f"{prop.name} · {unit.name}" if prop and unit else "—"
            type_label = {"section_21": "Section 21", "section_8": "Section 8", "section_13": "Section 13"}.get(n.notice_type, n.notice_type)
            extra = ""
            if n.notice_type == "section_8" and n.arrears_amount:
                extra = f", arrears £{n.arrears_amount:.2f}"
            elif n.notice_type == "section_13" and n.arrears_amount:
                extra = f", new rent £{n.arrears_amount:.2f} effective {n.possession_date}"
            elif n.notice_type == "section_21" and n.possession_date:
                extra = f", possession by {n.possession_date}"
            lines.append(f"  {type_label} — {tenant.full_name if tenant else '—'} — {label} — served {n.served_date}{extra}")

    # Recent payments (last 3 months, past due only — excludes future scheduled)
    from datetime import date, timedelta
    cutoff = date.today() - timedelta(days=90)
    payments = (
        db.query(RentPayment, Tenant, Property, Unit)
        .join(Lease, Lease.id == RentPayment.lease_id)
        .join(Tenant, Tenant.id == Lease.tenant_id)
        .join(Unit, Unit.id == Lease.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .filter(
            Property.organisation_id == org_id,
            RentPayment.due_date >= cutoff,
            RentPayment.due_date <= date.today()
        )
        .order_by(RentPayment.due_date.desc())
        .all()
    )
    if payments:
        lines.append("\nRECENT PAYMENTS (past 90 days, due dates up to today only):")
        for p, tenant, prop, unit in payments:
            paid = f"£{p.amount_paid:.2f} paid on {p.paid_date}" if p.amount_paid else "UNPAID"
            lines.append(f"  {tenant.full_name} — {prop.name} · {unit.name} — due £{p.amount_due:.2f} on {p.due_date} — {paid} ({p.status})")

    # Right to Rent (fields stored on Tenant model)
    rtr_tenants = db.query(Tenant).filter(
        Tenant.organisation_id == org_id, Tenant.rtr_check_date.isnot(None)
    ).all()
    if rtr_tenants:
        lines.append("\nRIGHT TO RENT:")
        today = date.today()
        for t in rtr_tenants:
            if not t.rtr_expiry_date:
                status = "valid (no expiry)"
            elif t.rtr_expiry_date < today:
                status = f"EXPIRED {(today - t.rtr_expiry_date).days}d ago"
            elif (t.rtr_expiry_date - today).days <= 28:
                status = f"expiring in {(t.rtr_expiry_date - today).days}d"
            else:
                status = "valid"
            lines.append(f"  {t.full_name} — {t.rtr_document_type or '—'} — checked {t.rtr_check_date} — expires {t.rtr_expiry_date or 'n/a'} — {status}")

    # Contractors
    contractors = db.query(Contractor).filter(Contractor.organisation_id == org_id).all()
    if contractors:
        lines.append("\nCONTRACTORS:")
        for c in contractors:
            lines.append(f"  {c.full_name} — {c.trade or '—'} — {c.email or '—'} — {c.phone or '—'}")

    # Upcoming renewals
    upcoming_renewals = (
        db.query(LeaseRenewal, Lease, Tenant, Unit, Property)
        .join(Lease, Lease.id == LeaseRenewal.lease_id)
        .join(Tenant, Tenant.id == Lease.tenant_id)
        .join(Unit, Unit.id == Lease.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .filter(Property.organisation_id == org_id, LeaseRenewal.status == "sent")
        .all()
    )
    if upcoming_renewals:
        lines.append("\nPENDING RENEWALS:")
        for r, lease, tenant, unit, prop in upcoming_renewals:
            lines.append(f"  {tenant.full_name} — {prop.name} · {unit.name} — proposed rent £{r.proposed_rent:.2f} from {r.proposed_start} — status: {r.status}")

    # Applicants / lettings pipeline
    from app.models.applicant import Applicant
    applicants = db.query(Applicant).filter(Applicant.organisation_id == org_id).order_by(Applicant.created_at.desc()).all()
    if applicants:
        lines.append("\nAPPLICANTS / LETTINGS PIPELINE:")
        for a in applicants:
            unit_label = ""
            if a.unit:
                unit_label = f" — interested in: {a.unit.name}"
            elif a.property:
                unit_label = f" — interested in: {a.property.name}"
            budget = f", budget: {a.monthly_budget}" if a.monthly_budget else ""
            viewing = f", viewing: {a.viewing_date.strftime('%d %b %Y') if a.viewing_date else '—'}"
            lines.append(f"  {a.full_name} ({a.source or '—'}) — stage: {a.status}{unit_label}{budget}{viewing}")

    # Inspections
    from app.models.inspection import Inspection
    inspections = (
        db.query(Inspection, Unit, Property)
        .join(Unit, Unit.id == Inspection.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .filter(Inspection.organisation_id == org_id)
        .order_by(Inspection.scheduled_date.desc())
        .limit(50)
        .all()
    )
    if inspections:
        lines.append("\nINSPECTIONS:")
        for ins, unit, prop in inspections:
            condition = f", condition: {ins.overall_condition}" if ins.overall_condition else ""
            lines.append(f"  {ins.type.replace('_',' ').title()} — {prop.name} · {unit.name} — {ins.scheduled_date} ({ins.status}){condition}")

    # Inventories
    from app.models.inventory import Inventory
    inventories = (
        db.query(Inventory, Lease, Tenant, Unit, Property)
        .join(Lease, Lease.id == Inventory.lease_id)
        .join(Tenant, Tenant.id == Lease.tenant_id)
        .join(Unit, Unit.id == Lease.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .filter(Inventory.organisation_id == org_id)
        .order_by(Inventory.inv_date.desc())
        .all()
    )
    if inventories:
        lines.append("\nINVENTORIES:")
        for inv, lease, tenant, unit, prop in inventories:
            keys = f", keys: {inv.keys_handed}" if inv.keys_handed else ""
            lines.append(f"  {inv.inv_type.replace('_',' ').title()} — {tenant.full_name} — {prop.name} · {unit.name} — {inv.inv_date}{keys}")

    # Dispatch queue
    from app.models.dispatch import DispatchQueue
    from app.models.maintenance import MaintenanceRequest
    queued = (
        db.query(DispatchQueue, MaintenanceRequest)
        .join(MaintenanceRequest, MaintenanceRequest.id == DispatchQueue.maintenance_request_id)
        .filter(DispatchQueue.organisation_id == org_id, DispatchQueue.status.in_(["queued", "dispatched"]))
        .all()
    )
    if queued:
        lines.append("\nDISPATCH QUEUE:")
        for dq, job in queued:
            lines.append(f"  [{dq.urgency}] {job.title} — {dq.trade} — {dq.area} — status: {dq.status}{', AI: ' + dq.ai_summary if dq.ai_summary else ''}")

    # Portal messages (last 30, unread flagged)
    from app.models.portal_message import PortalMessage
    from app.models.landlord import Landlord
    messages = (
        db.query(PortalMessage, Landlord)
        .join(Landlord, Landlord.id == PortalMessage.landlord_id)
        .filter(PortalMessage.organisation_id == org_id)
        .order_by(PortalMessage.created_at.desc())
        .limit(30)
        .all()
    )
    if messages:
        lines.append("\nPORTAL MESSAGES (recent 30):")
        for msg, ll in messages:
            read_flag = "" if msg.read else " [UNREAD]"
            lines.append(f"  [{msg.sender_type}] {ll.full_name}: {msg.body[:120]}{read_flag} — {msg.created_at.strftime('%d %b %Y') if msg.created_at else ''}")

    # Maintenance surveys
    from app.models.survey import MaintenanceSurvey
    surveys = (
        db.query(MaintenanceSurvey, Tenant)
        .outerjoin(Tenant, Tenant.id == MaintenanceSurvey.tenant_id)
        .filter(MaintenanceSurvey.organisation_id == org_id)
        .order_by(MaintenanceSurvey.sent_at.desc())
        .limit(50)
        .all()
    )
    if surveys:
        lines.append("\nMAINTENANCE SURVEYS:")
        for sv, tenant in surveys:
            responded = f"rating: {sv.rating}/5" if sv.rating else "not yet responded"
            comment = f", comment: {sv.comment[:100]}" if sv.comment else ""
            tname = tenant.full_name if tenant else "—"
            lines.append(f"  {tname} — job #{sv.job_id} — {responded}{comment}")

    # Contractor reviews
    from app.models.contractor_review import ContractorReview
    reviews = (
        db.query(ContractorReview, Contractor)
        .join(Contractor, Contractor.id == ContractorReview.contractor_id)
        .filter(Contractor.organisation_id == org_id)
        .order_by(ContractorReview.created_at.desc())
        .all()
    )
    if reviews:
        lines.append("\nCONTRACTOR REVIEWS:")
        for rv, c in reviews:
            comment = f": {rv.comment[:100]}" if rv.comment else ""
            lines.append(f"  {c.full_name} — {rv.stars}/5 by {rv.reviewer_name} ({rv.reviewer_type}){comment}")

    # Property valuations
    from app.models.valuation import PropertyValuation
    valuations = (
        db.query(PropertyValuation, Property)
        .join(Property, Property.id == PropertyValuation.property_id)
        .filter(PropertyValuation.organisation_id == org_id)
        .order_by(PropertyValuation.valuation_date.desc())
        .all()
    )
    if valuations:
        lines.append("\nPROPERTY VALUATIONS:")
        for v, prop in valuations:
            lines.append(f"  {prop.name} — £{v.estimated_value:,.0f} ({v.source or 'manual'}) — valued {v.valuation_date}")

    # PPM schedules
    from app.models.ppm import PPMSchedule
    ppms = (
        db.query(PPMSchedule, Property)
        .join(Property, Property.id == PPMSchedule.property_id)
        .filter(PPMSchedule.organisation_id == org_id, PPMSchedule.is_active == True)
        .order_by(PPMSchedule.next_due)
        .all()
    )
    if ppms:
        lines.append("\nPLANNED MAINTENANCE (PPM):")
        for ppm, prop in ppms:
            lines.append(f"  {ppm.title} — {prop.name} — {ppm.frequency} — next due: {ppm.next_due}")

    # Maintenance notes (recent, on open jobs)
    from app.models.maintenance_note import MaintenanceNote
    notes = (
        db.query(MaintenanceNote, MaintenanceRequest, Unit, Property)
        .join(MaintenanceRequest, MaintenanceRequest.id == MaintenanceNote.maintenance_request_id)
        .join(Unit, Unit.id == MaintenanceRequest.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .filter(Property.organisation_id == org_id)
        .order_by(MaintenanceNote.created_at.desc())
        .limit(30)
        .all()
    )
    if notes:
        lines.append("\nMAINTENANCE NOTES (recent 30):")
        for note, job, unit, prop in notes:
            lines.append(f"  [{note.author_type}] {note.author_name} on '{job.title}' ({prop.name} · {unit.name}): {note.body[:120]}")

    # 30-day metric history for trend analysis
    try:
        from datetime import timedelta
        from app.models.metric_snapshot import MetricSnapshot
        thirty_ago = date.today() - timedelta(days=30)
        snaps = db.query(MetricSnapshot).filter(
            MetricSnapshot.organisation_id == org_id,
            MetricSnapshot.date >= thirty_ago
        ).order_by(MetricSnapshot.date).all()
        if snaps:
            lines.append("\n=== 30-DAY METRIC HISTORY (use for trend questions) ===")
            lines.append("date | properties | units | vacant | active_leases | overdue_count | open_maintenance | applicants")
            for s in snaps:
                d = s.data
                lines.append(
                    f"{s.date} | {d.get('properties',0)} | {d.get('units',0)} | {d.get('vacant_units',0)} | "
                    f"{d.get('active_leases',0)} | {d.get('overdue_rent_count',0)} | {d.get('open_maintenance',0)} | {d.get('active_applicants',0)}"
                )
    except Exception:
        pass

    lines.append("\n=== END DATA — answer using only the above, do not invent names or numbers. ===")
    return "\n".join(lines)


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]


def _run_tool(name: str, args: dict, db: Session, org_id: int):
    fn = TOOL_FN_MAP.get(name)
    if not fn:
        return {"error": f"Unknown tool: {name}"}
    return fn(db=db, org_id=org_id, **args)


def _chat_anthropic(req: ChatRequest, db: Session, org_id: int, api_key: str):
    from app import wendy as _wendy
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    chart_result = None

    for _ in range(10):
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=_wendy.get('mendy_agent'),
            tools=ANTHROPIC_TOOLS,
            messages=messages,
        )

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        text_blocks = [b for b in response.content if b.type == "text"]

        if response.stop_reason == "end_turn" or not tool_uses:
            reply = "\n".join(b.text for b in text_blocks).strip()
            out = {"reply": reply or "I couldn't find an answer to that.", "model": "claude-haiku"}
            if chart_result:
                out["chart"] = chart_result
            return out

        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for tu in tool_uses:
            result = _run_tool(tu.name, tu.input, db, org_id)
            if tu.name == "render_chart":
                chart_result = result
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": json.dumps(result),
            })
        messages.append({"role": "user", "content": tool_results})

    out = {"reply": "I could not complete that request. Please try again.", "model": "claude-haiku"}
    if chart_result:
        out["chart"] = chart_result
    return out


def _chat_openai(req: ChatRequest, db: Session, org_id: int, client, model: str):
    from app import wendy as _wendy
    # Inject all portfolio data directly — no tool calls needed for local small models
    context = _build_context_prompt(db, org_id)
    system = _wendy.get('mendy_agent') + context
    messages = [{"role": "system", "content": system}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        response = client.chat.completions.create(model=model, messages=messages, timeout=60)
        return {"reply": response.choices[0].message.content or "", "model": model}
    except Exception as e:
        err = str(e)
        if "429" in err or "rate" in err.lower():
            raise HTTPException(status_code=503, detail="AI is busy — please wait a moment and try again.")
        raise


@router.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Try Anthropic Claude if key present and funded
    if settings.anthropic_api_key:
        try:
            return _chat_anthropic(req, db, current_user.organisation_id, settings.anthropic_api_key)
        except Exception:
            pass  # Fall through to Groq/Ollama

    # 2. Ollama (free, local) / Mistral
    client, model = get_openai_client()
    if client:
        return _chat_openai(req, db, current_user.organisation_id, client, model)

    raise HTTPException(status_code=500, detail="No AI provider available.")


# ── Portal AI chat endpoints ───────────────────────────────────────────────────
# Each endpoint: uses portal-specific auth, builds context from THAT user's
# data only, calls the same AI backend. No cross-portal data leakage.

def _portal_chat(messages_in, system_prompt: str, context: str):
    """Run a portal chat using available AI backend (Anthropic → Groq → fail)."""
    return _portal_chat_with_tools(messages_in, system_prompt, context, tools=[], tool_fn_map={})


def _portal_chat_with_tools(messages_in, system_prompt: str, context: str, tools: list, tool_fn_map: dict):
    """Portal chat with optional tool support. tools: OpenAI function-format list."""
    from app.config import settings

    full_system = system_prompt + "\n\n" + context

    if settings.anthropic_api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            anthr_tools = [
                {"name": t["function"]["name"], "description": t["function"]["description"],
                 "input_schema": t["function"]["parameters"]}
                for t in tools
            ]
            msgs = [{"role": m["role"], "content": m["content"]} for m in messages_in]
            for _ in range(6):
                kw = {"tools": anthr_tools} if anthr_tools else {}
                response = client.messages.create(
                    model="claude-haiku-4-5-20251001", max_tokens=1024,
                    system=full_system, messages=msgs, **kw
                )
                tool_uses = [b for b in response.content if b.type == "tool_use"]
                text_blocks = [b for b in response.content if b.type == "text"]
                if response.stop_reason == "end_turn" or not tool_uses:
                    reply = "\n".join(b.text for b in text_blocks).strip()
                    return {"reply": reply or "I'm not sure about that. Please contact your agent."}
                msgs.append({"role": "assistant", "content": response.content})
                results = []
                for tu in tool_uses:
                    fn = tool_fn_map.get(tu.name)
                    result = fn(**tu.input) if fn else {"error": "unknown tool"}
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "content": json.dumps(result)})
                msgs.append({"role": "user", "content": results})
            return {"reply": "I could not complete that request."}
        except Exception as e:
            print(f"[portal_ai] Anthropic failed: {e}")

    client_oa, model = get_openai_client()
    if client_oa:
        msgs_oa = [{"role": "system", "content": full_system}]
        msgs_oa += [{"role": m["role"], "content": m["content"]} for m in messages_in]
        for _ in range(6):
            try:
                kw = {"tools": tools} if tools else {}
                response = client_oa.chat.completions.create(model=model, messages=msgs_oa, timeout=60, **kw)
                choice = response.choices[0]
                if tools and choice.finish_reason == "tool_calls" and choice.message.tool_calls:
                    msgs_oa.append(choice.message)
                    for tc in choice.message.tool_calls:
                        args = json.loads(tc.function.arguments or "{}")
                        fn = tool_fn_map.get(tc.function.name)
                        result = fn(**args) if fn else {"error": "unknown tool"}
                        msgs_oa.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
                else:
                    return {"reply": choice.message.content or ""}
            except Exception as e:
                raise HTTPException(status_code=503, detail="AI is busy — please try again shortly.")
        return {"reply": "I could not complete that request."}

    raise HTTPException(status_code=500, detail="No AI provider configured.")


# ── Tenant portal AI ──────────────────────────────────────────────────────────

TENANT_AI_SYSTEM = """You are Wendy (or Mendy), a friendly and helpful AI assistant embedded in the tenant portal of PropAIrty, a UK property management platform.

You ONLY have access to the data of the specific tenant you are speaking with. You NEVER discuss other tenants, other properties, financial details unrelated to this tenant, or agent-only information.

You help tenants:
- Understand their lease details, rent amount, and lease dates
- Check their payment history and outstanding balances
- Understand the status of their maintenance requests
- Know what documents they have on file
- Understand their deposit details
- Know how to contact their agent

Be warm, reassuring, and clear. Use plain English — not legal jargon. If the tenant asks something outside your data, let them know.

You can send a message to the letting agent on the tenant's behalf using the send_message_to_agent tool. Use this ONLY when the tenant explicitly asks you to send, write, or forward a message. Draft the message clearly and confirm once sent."""

@router.post("/tenant-chat")
def tenant_chat(req: ChatRequest, db: Session = Depends(get_db), tenant=Depends(lambda: None)):
    from app.routers.tenant_portal import get_current_tenant
    from fastapi import Request
    raise HTTPException(status_code=501, detail="Use /api/tenant/portal/ai-chat")


from app.models.tenant import Tenant as _Tenant
from app.models.lease import Lease as _Lease
from app.models.unit import Unit as _Unit
from app.models.property import Property as _Property
from app.models.payment import RentPayment as _RentPayment
from app.models.maintenance import MaintenanceRequest as _MR
from app.models.deposit import TenancyDeposit as _Dep

def _tenant_context(tenant, db: Session) -> str:
    lines = [f"=== TENANT: {tenant.full_name} ===",
             f"Email: {tenant.email or '—'} | Phone: {tenant.phone or '—'}"]
    lease = db.query(_Lease).filter(_Lease.tenant_id == tenant.id, _Lease.status == "active").first()
    if lease:
        unit = db.query(_Unit).get(lease.unit_id)
        prop = db.query(_Property).get(unit.property_id) if unit else None
        dep = db.query(_Dep).filter(_Dep.lease_id == lease.id).first()
        lines += [
            f"Property: {prop.name if prop else '—'}, Unit: {unit.name if unit else '—'}",
            f"Lease: {lease.start_date} to {lease.end_date} | Rent: £{lease.monthly_rent}/month",
            f"Deposit: £{dep.amount} ({dep.scheme}, {dep.status})" if dep else "Deposit: none on record",
        ]
        payments = db.query(_RentPayment).filter(_RentPayment.lease_id == lease.id).order_by(_RentPayment.due_date.desc()).limit(12).all()
        overdue = [p for p in payments if p.status in ("overdue", "partial")]
        lines.append(f"Recent payments: {len(payments)} records, {len(overdue)} overdue/partial")
        for p in payments[:6]:
            lines.append(f"  - {p.due_date}: £{p.amount_due} due, £{p.amount_paid or 0} paid — {p.status}")
    else:
        lines.append("No active lease found.")
    maint = db.query(_MR).filter(
        _MR.organisation_id == tenant.organisation_id,
        (_MR.reported_by_tenant_id == tenant.id) | (_MR.reported_by == tenant.full_name)
    ).order_by(_MR.created_at.desc()).limit(10).all()
    lines.append(f"Maintenance ({len(maint)} recent):")
    for m in maint:
        lines.append(f"  - [{m.status}] {m.title} (priority: {m.priority})")
    return "\n".join(lines)


# ── Landlord portal AI ────────────────────────────────────────────────────────

LANDLORD_AI_SYSTEM = """You are Wendy (or Mendy), a friendly and knowledgeable AI assistant embedded in the landlord portal of PropAIrty, a UK property management platform.

You ONLY have access to this specific landlord's properties and data. You NEVER discuss other landlords, other landlords' tenants, or any agent-internal information.

You help landlords:
- Understand their property portfolio performance
- Check rent collection and arrears for their properties
- Review maintenance activity on their properties
- Understand upcoming lease renewals
- Clarify deposit details
- Get summary financials

Be professional but approachable. Speak in plain English. If they ask for something outside your data (e.g. market valuations, legal advice), let them know.

You can send a message to the letting agent on the landlord's behalf using the send_message_to_agent tool. Use this ONLY when the landlord explicitly asks you to send, write, or forward a message. Draft the message clearly and confirm once sent."""

def _landlord_context(landlord, db: Session) -> str:
    from app.models.property import Property as _P
    from app.models.unit import Unit as _U
    from app.models.lease import Lease as _L
    from app.models.payment import RentPayment as _RP
    from app.models.maintenance import MaintenanceRequest as _M
    lines = [f"=== LANDLORD: {landlord.full_name} ===",
             f"Email: {landlord.email} | Company: {landlord.company_name or '—'}"]
    props = db.query(_P).filter(_P.landlord_id == landlord.id).all()
    lines.append(f"Properties owned: {len(props)}")
    total_rent = 0
    total_arrears = 0
    for p in props:
        units = db.query(_U).filter(_U.property_id == p.id).all()
        lines.append(f"\nProperty: {p.name} ({p.address_line1 or ''})")
        for u in units:
            lease = db.query(_L).filter(_L.unit_id == u.id, _L.status == "active").first()
            if lease:
                total_rent += (lease.monthly_rent or 0)
                overdue_p = db.query(_RP).filter(_RP.lease_id == lease.id, _RP.status.in_(["overdue", "partial"])).all()
                arrears = sum((p2.amount_due or 0) - (p2.amount_paid or 0) for p2 in overdue_p)
                total_arrears += arrears
                lines.append(f"  Unit {u.name}: leased at £{lease.monthly_rent}/mo, expires {lease.end_date}" +
                             (f", arrears £{arrears:.0f}" if arrears > 0 else ""))
            else:
                lines.append(f"  Unit {u.name}: VACANT")
        open_maint = db.query(_M).filter(_M.property_id == p.id, _M.status.in_(["open", "in_progress"])).count()
        if open_maint:
            lines.append(f"  Open maintenance: {open_maint} job(s)")
    lines.append(f"\nTotal monthly rent roll: £{total_rent:,.0f}")
    lines.append(f"Total arrears: £{total_arrears:,.0f}" if total_arrears else "No arrears outstanding.")
    return "\n".join(lines)


# ── Contractor portal AI ──────────────────────────────────────────────────────

CONTRACTOR_AI_SYSTEM = """You are Wendy (or Mendy), a helpful AI assistant embedded in the contractor portal of PropAIrty, a UK property management platform.

You ONLY have access to the jobs assigned to this specific contractor. You NEVER discuss other contractors, their jobs, or any financial or tenant data.

You help contractors:
- See a summary of their active and completed jobs
- Understand job details, priorities, and addresses
- Know what job notes have been added
- Understand what needs doing next

Be practical and to the point. If they need more detail than you have, let them know.

You can send a message to the letting agent on the contractor's behalf using the send_message_to_agent tool. Use this ONLY when the contractor explicitly asks you to send, write, or forward a message. Draft the message clearly and confirm once sent."""

def _contractor_context(contractor, db: Session) -> str:
    from app.models.maintenance import MaintenanceRequest as _M
    lines = [f"=== CONTRACTOR: {contractor.full_name} ({contractor.company_name or ''}) ===",
             f"Trade: {contractor.trade or '—'} | Email: {contractor.email or '—'}"]
    jobs = db.query(_M).filter(_M.contractor_id == contractor.id).order_by(_M.created_at.desc()).limit(20).all()
    active = [j for j in jobs if j.status in ("open", "in_progress")]
    done = [j for j in jobs if j.status == "completed"]
    lines.append(f"Active jobs: {len(active)}, Completed: {len(done)}")
    for j in jobs:
        unit = db.query(_Unit).get(j.unit_id) if j.unit_id else None
        prop = db.query(_Property).get(j.property_id) if j.property_id else None
        lines.append(f"  [{j.status}] {j.title} | Priority: {j.priority} | {prop.name if prop else '—'}, {unit.name if unit else '—'}")
        if j.description:
            lines.append(f"    Description: {j.description[:100]}")
    return "\n".join(lines)
