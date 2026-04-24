#!/usr/bin/env python3
"""
PropAIrty AI Autopilot — monitors all workflows across every portal
and nudges the right person when something stalls.

Run via cron (e.g. every 4 hours):
  0 */4 * * * cd /root/propairty/backend && python scripts/run_autopilot.py >> /var/log/propairty_autopilot.log 2>&1
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta, timezone, date
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.autopilot import AutopilotConfig, AutopilotLog
from app.models.organisation import Organisation

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [Autopilot] %(message)s')
log = logging.getLogger(__name__)


# ── Default thresholds ────────────────────────────────────────────────────────

CHECKS_META = {
    "maintenance_unassigned": {
        "label": "Maintenance unassigned",
        "description": "Alert agent when a job has been open but not assigned to a contractor",
        "default_days": 2,
        "unit": "days open",
        "dedup_hours": 24,
    },
    "maintenance_stalled": {
        "label": "Maintenance stalled",
        "description": "Chase contractor and alert agent when a job has had no update",
        "default_days": 5,
        "unit": "days without update",
        "dedup_hours": 72,
    },
    "tenant_message_unanswered": {
        "label": "Tenant message unanswered",
        "description": "Alert agent when a tenant's portal message has no reply",
        "default_days": 1,
        "unit": "days without reply",
        "dedup_hours": 24,
    },
    "contractor_message_unanswered": {
        "label": "Contractor message unanswered",
        "description": "Alert agent when a contractor's portal message has no reply",
        "default_days": 2,
        "unit": "days without reply",
        "dedup_hours": 48,
    },
    "lease_expiring_no_offer": {
        "label": "Lease expiring — no renewal offer",
        "description": "Alert agent when a lease is approaching end with no renewal offer sent",
        "default_days": 60,
        "unit": "days before expiry",
        "dedup_hours": 168,  # once a week
    },
    "renewal_no_response": {
        "label": "Renewal offer — no tenant response",
        "description": "Send tenant a gentle reminder when they haven't responded to a renewal offer",
        "default_days": 7,
        "unit": "days since offer sent",
        "dedup_hours": 120,
    },
    "compliance_expiring": {
        "label": "Compliance certificate expiring",
        "description": "Alert agent when a certificate is expiring soon with no job scheduled",
        "default_days": 45,
        "unit": "days before expiry",
        "dedup_hours": 168,
    },
    "arrears_chase": {
        "label": "Rent arrears — tenant chase",
        "description": "Send tenant a portal message and alert agent when rent is overdue",
        "default_days": 5,
        "unit": "days overdue",
        "dedup_hours": 72,
    },
    "applicant_followup_overdue": {
        "label": "Applicant follow-up overdue",
        "description": "Alert agent when an applicant's follow-up date has passed with no stage change",
        "default_days": 0,
        "unit": "days since follow-up date",
        "dedup_hours": 24,
    },
    "applicant_stage_stalled": {
        "label": "Applicant stuck at stage",
        "description": "Alert agent when an applicant hasn't progressed through the pipeline",
        "default_days": 7,
        "unit": "days at same stage",
        "dedup_hours": 48,
    },
    "applicant_referencing_stalled": {
        "label": "Referencing stalled",
        "description": "Alert agent when an applicant has been in referencing for too long",
        "default_days": 10,
        "unit": "days in referencing",
        "dedup_hours": 48,
    },
    "deposit_not_registered": {
        "label": "Deposit not registered",
        "description": "Alert agent when an active tenancy has no deposit record on file",
        "default_days": 3,
        "unit": "days since tenancy started",
        "dedup_hours": 48,
    },
    "inventory_missing_movein": {
        "label": "Move-in inventory missing",
        "description": "Alert agent when a tenancy has started but no check-in inventory exists",
        "default_days": 3,
        "unit": "days since tenancy started",
        "dedup_hours": 48,
    },
    "tenant_portal_inactive": {
        "label": "Tenant portal not activated",
        "description": "Alert agent when an active tenant has not been set up with portal access",
        "default_days": 3,
        "unit": "days since tenancy started",
        "dedup_hours": 168,
    },
    "survey_not_sent": {
        "label": "Satisfaction survey not sent",
        "description": "Remind agent to send a satisfaction survey after a maintenance job completes",
        "default_days": 2,
        "unit": "days since job completed",
        "dedup_hours": 168,
    },
    "landlord_message_unread": {
        "label": "Landlord message unread",
        "description": "Alert agent when a landlord has sent a portal message that hasn't been read",
        "default_days": 2,
        "unit": "days unread",
        "dedup_hours": 24,
    },
    "renewal_pending_too_long": {
        "label": "Renewal offer — no landlord action",
        "description": "Alert agent when a sent lease renewal has had no response from the landlord",
        "default_days": 14,
        "unit": "days since offer sent",
        "dedup_hours": 168,
    },
    "no_inspection": {
        "label": "No inspection in 6 months",
        "description": "Alert agent when an occupied unit has not been inspected recently",
        "default_days": 180,
        "unit": "days since last inspection",
        "dedup_hours": 168,
    },
    "vacant_unit_matches": {
        "label": "Vacant unit — applicant matches",
        "description": "Alert agent when a vacant unit has applicants whose preferences match",
        "default_days": 1,
        "unit": "days vacant",
        "dedup_hours": 48,
    },
}

DEFAULT_CONFIG = {k: {"enabled": True, "days": v["default_days"]} for k, v in CHECKS_META.items()}


# ── Groq message generation ───────────────────────────────────────────────────

def _generate_message(recipient_type: str, situation: str, context: dict) -> str:
    """Use Groq to generate a natural, contextual message. Falls back to template."""
    try:
        from openai import OpenAI
        from app.config import settings
        if not settings.groq_api_key:
            raise ValueError("No Groq key")
        client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=settings.groq_api_key)
        ctx_str = "\n".join(f"- {k}: {v}" for k, v in context.items())
        prompt = f"""You are an AI assistant for a UK letting agency called PropAIrty.
Write a brief, professional message to a {recipient_type}.
Situation: {situation}
Context:
{ctx_str}

Rules:
- Maximum 3 sentences
- Friendly but professional UK English
- Do NOT use markdown or bullet points
- Do NOT start with "Dear" or "Hello" — just jump in naturally
- Do NOT mention "AI" or "automated"
- Sign off as "The {context.get('agency_name', 'PropAIrty')} Team"

Write only the message, nothing else."""
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        log.warning(f"Groq generation failed: {e} — using template")
        return None


# ── Deduplication ─────────────────────────────────────────────────────────────

def _already_sent(db: Session, org_id: int, dedup_key: str, hours: int) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    existing = db.query(AutopilotLog).filter(
        AutopilotLog.organisation_id == org_id,
        AutopilotLog.dedup_key == dedup_key,
        AutopilotLog.created_at >= cutoff,
    ).first()
    return existing is not None


def _log_action(db: Session, org_id: int, check_type: str, entity_type: str,
                entity_id, action: str, recipient_label: str, summary: str,
                message_sent: str, dedup_key: str):
    entry = AutopilotLog(
        organisation_id=org_id,
        check_type=check_type,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        recipient_label=recipient_label,
        summary=summary,
        message_sent=message_sent,
        dedup_key=dedup_key,
    )
    db.add(entry)
    db.commit()


# ── Portal message helpers ────────────────────────────────────────────────────

def _send_tenant_message(db: Session, org_id: int, tenant_id: int, body: str):
    from app.models.tenant_message import TenantMessage
    msg = TenantMessage(
        organisation_id=org_id,
        tenant_id=tenant_id,
        sender_type="agent",
        sender_name="PropAIrty Autopilot",
        body=body,
        read=False,
    )
    db.add(msg)
    db.commit()


def _send_contractor_message(db: Session, org_id: int, contractor_id: int, body: str):
    from app.models.contractor_message import ContractorMessage
    msg = ContractorMessage(
        organisation_id=org_id,
        contractor_id=contractor_id,
        sender_type="agent",
        sender_name="PropAIrty Autopilot",
        body=body,
        read=False,
    )
    db.add(msg)
    db.commit()


def _send_agent_alert(org_id: int, message: str):
    """Send Telegram alert to agent (non-blocking)."""
    try:
        from app import notifications
        notifications.send(f"🤖 <b>Autopilot</b>\n{message}")
    except Exception:
        pass


# ── Individual checks ─────────────────────────────────────────────────────────

def check_maintenance_unassigned(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.maintenance import MaintenanceRequest
    from app.models.unit import Unit
    from app.models.property import Property
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    jobs = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        MaintenanceRequest.status == "open",
        MaintenanceRequest.contractor_id == None,
        MaintenanceRequest.created_at <= cutoff,
    ).all()
    for job in jobs:
        dedup = f"maintenance_unassigned:{job.id}"
        if _already_sent(db, org_id, dedup, 24):
            continue
        unit = db.query(Unit).join(Property).filter(Unit.id == job.unit_id).first()
        addr = unit.property.name if unit else "Unknown property"
        summary = f"Job #{job.id} '{job.title}' at {addr} has been open {days}+ days with no contractor assigned"
        if not dry_run:
            _send_agent_alert(org_id, f"⚠️ {summary}")
            _log_action(db, org_id, "maintenance_unassigned", "maintenance", job.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "maintenance_unassigned", "summary": summary, "entity_id": job.id})
    return results


def check_maintenance_stalled(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.maintenance import MaintenanceRequest
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.contractor import Contractor
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    jobs = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        MaintenanceRequest.status.in_(["open", "in_progress"]),
        MaintenanceRequest.contractor_id != None,
        MaintenanceRequest.updated_at <= cutoff,
    ).all()
    for job in jobs:
        dedup = f"maintenance_stalled:{job.id}"
        if _already_sent(db, org_id, dedup, 72):
            continue
        contractor = db.query(Contractor).filter(Contractor.id == job.contractor_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == job.unit_id).first()
        addr = unit.property.name if unit else "Unknown property"
        c_name = contractor.company_name if contractor else "Contractor"
        ctx = {"agency_name": agency_name, "contractor_name": c_name, "job_title": job.title,
                "property": addr, "job_id": job.id, "days_since_update": days}
        msg = _generate_message("contractor", f"maintenance job #{job.id} has had no update for {days} days", ctx)
        if not msg:
            msg = (f"Hi {c_name}, just following up on job #{job.id} — '{job.title}' at {addr}. "
                   f"Could you let us know the current status and expected completion date? "
                   f"Many thanks, The {agency_name} Team")
        summary = f"Job #{job.id} '{job.title}' at {addr} assigned to {c_name} — no update for {days}+ days"
        if not dry_run:
            if contractor:
                _send_contractor_message(db, org_id, contractor.id, msg)
            _send_agent_alert(org_id, f"🔧 {summary} — chased contractor")
            _log_action(db, org_id, "maintenance_stalled", "maintenance", job.id,
                        "portal_message_contractor", c_name, summary, msg, dedup)
        results.append({"check": "maintenance_stalled", "summary": summary, "entity_id": job.id})
    return results


def check_tenant_message_unanswered(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.tenant_message import TenantMessage
    from app.models.tenant import Tenant
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    # Find tenants who sent a message after which there's no agent reply
    tenants_with_msgs = db.query(TenantMessage.tenant_id).filter(
        TenantMessage.organisation_id == org_id,
        TenantMessage.sender_type == "tenant",
        TenantMessage.created_at <= cutoff,
    ).distinct().all()
    for (tenant_id,) in tenants_with_msgs:
        # Check if there's an agent reply after the last tenant message
        last_tenant_msg = db.query(TenantMessage).filter(
            TenantMessage.organisation_id == org_id,
            TenantMessage.tenant_id == tenant_id,
            TenantMessage.sender_type == "tenant",
        ).order_by(TenantMessage.created_at.desc()).first()
        if not last_tenant_msg:
            continue
        agent_reply = db.query(TenantMessage).filter(
            TenantMessage.organisation_id == org_id,
            TenantMessage.tenant_id == tenant_id,
            TenantMessage.sender_type == "agent",
            TenantMessage.created_at >= last_tenant_msg.created_at,
        ).first()
        if agent_reply:
            continue
        dedup = f"tenant_message_unanswered:{tenant_id}"
        if _already_sent(db, org_id, dedup, 24):
            continue
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        t_name = tenant.full_name if tenant else "Tenant"
        summary = f"Message from {t_name} has had no reply for {days}+ day(s)"
        if not dry_run:
            _send_agent_alert(org_id, f"💬 {summary}")
            _log_action(db, org_id, "tenant_message_unanswered", "tenant", tenant_id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "tenant_message_unanswered", "summary": summary, "entity_id": tenant_id})
    return results


def check_contractor_message_unanswered(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.contractor_message import ContractorMessage
    from app.models.contractor import Contractor
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    contractors_with_msgs = db.query(ContractorMessage.contractor_id).filter(
        ContractorMessage.organisation_id == org_id,
        ContractorMessage.sender_type == "contractor",
        ContractorMessage.created_at <= cutoff,
    ).distinct().all()
    for (contractor_id,) in contractors_with_msgs:
        last_msg = db.query(ContractorMessage).filter(
            ContractorMessage.organisation_id == org_id,
            ContractorMessage.contractor_id == contractor_id,
            ContractorMessage.sender_type == "contractor",
        ).order_by(ContractorMessage.created_at.desc()).first()
        if not last_msg:
            continue
        agent_reply = db.query(ContractorMessage).filter(
            ContractorMessage.organisation_id == org_id,
            ContractorMessage.contractor_id == contractor_id,
            ContractorMessage.sender_type == "agent",
            ContractorMessage.created_at >= last_msg.created_at,
        ).first()
        if agent_reply:
            continue
        dedup = f"contractor_message_unanswered:{contractor_id}"
        if _already_sent(db, org_id, dedup, 48):
            continue
        contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
        c_name = contractor.company_name if contractor else "Contractor"
        summary = f"Message from {c_name} has had no reply for {days}+ day(s)"
        if not dry_run:
            _send_agent_alert(org_id, f"💬 {summary}")
            _log_action(db, org_id, "contractor_message_unanswered", "contractor", contractor_id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "contractor_message_unanswered", "summary": summary, "entity_id": contractor_id})
    return results


def check_lease_expiring_no_offer(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.lease import Lease
    from app.models.renewal import RenewalOffer
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.tenant import Tenant
    results = []
    today = date.today()
    cutoff_date = today + timedelta(days=days)
    leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Lease.status == "active",
        Lease.end_date <= cutoff_date,
        Lease.end_date >= today,
    ).all()
    for lease in leases:
        # Check if a renewal offer already exists
        offer = db.query(RenewalOffer).filter(RenewalOffer.lease_id == lease.id).first()
        if offer:
            continue
        dedup = f"lease_expiring_no_offer:{lease.id}"
        if _already_sent(db, org_id, dedup, 168):
            continue
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        t_name = tenant.full_name if tenant else "Tenant"
        addr = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
        days_left = (lease.end_date - today).days
        summary = f"Lease for {t_name} at {addr} expires in {days_left} days — no renewal offer sent"
        if not dry_run:
            _send_agent_alert(org_id, f"📋 {summary}")
            _log_action(db, org_id, "lease_expiring_no_offer", "lease", lease.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "lease_expiring_no_offer", "summary": summary, "entity_id": lease.id})
    return results


def check_renewal_no_response(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.renewal import RenewalOffer
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.tenant import Tenant
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    offers = db.query(RenewalOffer).join(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        RenewalOffer.status == "pending",
        RenewalOffer.created_at <= cutoff,
    ).all()
    for offer in offers:
        dedup = f"renewal_no_response:{offer.id}"
        if _already_sent(db, org_id, dedup, 120):
            continue
        lease = db.query(Lease).filter(Lease.id == offer.lease_id).first()
        if not lease:
            continue
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        t_name = tenant.full_name if tenant else "Tenant"
        addr = unit.property.name if unit else "your property"
        ctx = {"agency_name": agency_name, "tenant_name": t_name.split()[0],
                "property": addr, "new_rent": f"£{offer.proposed_rent}/month" if offer.proposed_rent else "unchanged",
                "offer_days_ago": days}
        msg = _generate_message("tenant", f"renewal offer sent {days} days ago with no response", ctx)
        if not msg:
            msg = (f"Just a reminder that we sent you a renewal offer for {addr} {days} days ago — "
                   f"could you log into your tenant portal and let us know if you'd like to accept or decline? "
                   f"Happy to chat through any questions. The {agency_name} Team")
        summary = f"Renewal offer for {t_name} at {addr} — no response after {days} days"
        if not dry_run and tenant:
            _send_tenant_message(db, org_id, tenant.id, msg)
            _log_action(db, org_id, "renewal_no_response", "renewal", offer.id,
                        "portal_message_tenant", t_name, summary, msg, dedup)
        results.append({"check": "renewal_no_response", "summary": summary, "entity_id": offer.id})
    return results


def check_compliance_expiring(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.compliance import ComplianceCertificate, CERT_TYPES
    from app.models.property import Property
    results = []
    today = date.today()
    warn_date = today + timedelta(days=days)
    certs = db.query(ComplianceCertificate).join(Property).filter(
        Property.organisation_id == org_id,
        ComplianceCertificate.expiry_date >= today,
        ComplianceCertificate.expiry_date <= warn_date,
    ).all()
    for cert in certs:
        dedup = f"compliance_expiring:{cert.id}"
        if _already_sent(db, org_id, dedup, 168):
            continue
        prop = db.query(Property).filter(Property.id == cert.property_id).first()
        cert_label = CERT_TYPES.get(cert.cert_type, {}).get("label", cert.cert_type) if isinstance(CERT_TYPES.get(cert.cert_type), dict) else cert.cert_type
        days_left = (cert.expiry_date - today).days
        summary = f"{cert_label} at {prop.name if prop else 'Unknown'} expires in {days_left} days"
        if not dry_run:
            _send_agent_alert(org_id, f"📋 Compliance: {summary}")
            _log_action(db, org_id, "compliance_expiring", "compliance", cert.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "compliance_expiring", "summary": summary, "entity_id": cert.id})
    return results


def check_arrears_chase(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.payment import RentPayment
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.tenant import Tenant
    results = []
    cutoff = date.today() - timedelta(days=days)
    payments = db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        RentPayment.status.in_(["overdue", "partial"]),
        RentPayment.due_date <= cutoff,
    ).all()
    for pmt in payments:
        dedup = f"arrears_chase:{pmt.id}"
        if _already_sent(db, org_id, dedup, 72):
            continue
        lease = db.query(Lease).filter(Lease.id == pmt.lease_id).first()
        if not lease:
            continue
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        t_name = tenant.full_name if tenant else "Tenant"
        addr = unit.property.name if unit else "your property"
        overdue_days = (date.today() - pmt.due_date).days
        owed = pmt.amount_due - (pmt.amount_paid or 0)
        ctx = {"agency_name": agency_name, "tenant_name": t_name.split()[0],
                "property": addr, "amount_owed": f"£{owed:.2f}",
                "due_date": str(pmt.due_date), "days_overdue": overdue_days}
        msg = _generate_message("tenant", f"rent payment of £{owed:.2f} is {overdue_days} days overdue", ctx)
        if not msg:
            msg = (f"We wanted to flag that your rent payment of £{owed:.2f} for {addr}, "
                   f"due on {pmt.due_date}, is now {overdue_days} days overdue. "
                   f"Please make payment at your earliest convenience or get in touch if there's an issue. "
                   f"The {agency_name} Team")
        summary = f"Rent arrears: {t_name} — £{owed:.2f} overdue {overdue_days} days (payment #{pmt.id})"
        if not dry_run and tenant:
            _send_tenant_message(db, org_id, tenant.id, msg)
            _send_agent_alert(org_id, f"💷 {summary} — tenant chased")
            _log_action(db, org_id, "arrears_chase", "payment", pmt.id,
                        "portal_message_tenant", t_name, summary, msg, dedup)
        results.append({"check": "arrears_chase", "summary": summary, "entity_id": pmt.id})
    return results


def check_applicant_followup_overdue(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.applicant import Applicant
    results = []
    today = date.today()
    applicants = db.query(Applicant).filter(
        Applicant.organisation_id == org_id,
        Applicant.follow_up_date != None,
        Applicant.follow_up_date <= today,
        ~Applicant.status.in_(["rejected", "withdrawn", "tenancy_created"]),
    ).all()
    for a in applicants:
        dedup = f"applicant_followup:{a.id}"
        if _already_sent(db, org_id, dedup, 24):
            continue
        days_overdue = (today - a.follow_up_date).days
        note = f" — Note: {a.follow_up_note}" if a.follow_up_note else ""
        summary = (f"Follow-up overdue for {a.full_name} ({a.status}) — "
                   f"{days_overdue} day(s) past {a.follow_up_date}{note}")
        if not dry_run:
            _send_agent_alert(org_id, f"👤 {summary}")
            _log_action(db, org_id, "applicant_followup_overdue", "applicant", a.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "applicant_followup_overdue", "summary": summary, "entity_id": a.id})
    return results


def check_applicant_stage_stalled(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.applicant import Applicant
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    STALL_STAGES = ["enquiry", "viewing_booked", "viewed", "referencing", "approved"]
    applicants = db.query(Applicant).filter(
        Applicant.organisation_id == org_id,
        Applicant.status.in_(STALL_STAGES),
        Applicant.updated_at <= cutoff,
    ).all()
    for a in applicants:
        dedup = f"applicant_stage_stalled:{a.id}"
        if _already_sent(db, org_id, dedup, 48):
            continue
        summary = f"{a.full_name} has been at '{a.status}' stage for {days}+ days with no update"
        if not dry_run:
            _send_agent_alert(org_id, f"👤 {summary}")
            _log_action(db, org_id, "applicant_stage_stalled", "applicant", a.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "applicant_stage_stalled", "summary": summary, "entity_id": a.id})
    return results


def check_applicant_referencing_stalled(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.applicant import Applicant
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    applicants = db.query(Applicant).filter(
        Applicant.organisation_id == org_id,
        Applicant.status == "referencing",
        Applicant.updated_at <= cutoff,
    ).all()
    for a in applicants:
        dedup = f"applicant_referencing:{a.id}"
        if _already_sent(db, org_id, dedup, 48):
            continue
        ref_status = a.referencing_status or "not_started"
        summary = f"{a.full_name} has been in referencing for {days}+ days — status: {ref_status}"
        if not dry_run:
            _send_agent_alert(org_id, f"📋 {summary}")
            _log_action(db, org_id, "applicant_referencing_stalled", "applicant", a.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "applicant_referencing_stalled", "summary": summary, "entity_id": a.id})
    return results


def check_deposit_not_registered(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.lease import Lease
    from app.models.deposit import TenancyDeposit
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.tenant import Tenant
    results = []
    cutoff = date.today() - timedelta(days=days)
    leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Lease.status == "active",
        Lease.start_date <= cutoff,
    ).all()
    for lease in leases:
        deposit = db.query(TenancyDeposit).filter(TenancyDeposit.lease_id == lease.id).first()
        if deposit:
            continue
        dedup = f"deposit_not_registered:{lease.id}"
        if _already_sent(db, org_id, dedup, 48):
            continue
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        t_name = tenant.full_name if tenant else "Tenant"
        addr = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
        summary = f"No deposit registered for {t_name} at {addr} — tenancy started {lease.start_date}"
        if not dry_run:
            _send_agent_alert(org_id, f"💰 {summary}")
            _log_action(db, org_id, "deposit_not_registered", "lease", lease.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "deposit_not_registered", "summary": summary, "entity_id": lease.id})
    return results


def check_inventory_missing_movein(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.lease import Lease
    from app.models.inventory import Inventory
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.tenant import Tenant
    results = []
    cutoff = date.today() - timedelta(days=days)
    leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Lease.status == "active",
        Lease.start_date <= cutoff,
    ).all()
    for lease in leases:
        inv = db.query(Inventory).filter(
            Inventory.lease_id == lease.id,
            Inventory.inv_type == "check_in",
        ).first()
        if inv:
            continue
        dedup = f"inventory_missing_movein:{lease.id}"
        if _already_sent(db, org_id, dedup, 48):
            continue
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        t_name = tenant.full_name if tenant else "Tenant"
        addr = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
        summary = f"No check-in inventory for {t_name} at {addr} — tenancy started {lease.start_date}"
        if not dry_run:
            _send_agent_alert(org_id, f"📋 {summary}")
            _log_action(db, org_id, "inventory_missing_movein", "lease", lease.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "inventory_missing_movein", "summary": summary, "entity_id": lease.id})
    return results


def check_tenant_portal_inactive(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.tenant import Tenant
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    results = []
    cutoff = date.today() - timedelta(days=days)
    leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Lease.status == "active",
        Lease.start_date <= cutoff,
    ).all()
    for lease in leases:
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        if not tenant:
            continue
        if tenant.portal_enabled and tenant.hashed_password:
            continue
        dedup = f"tenant_portal_inactive:{tenant.id}"
        if _already_sent(db, org_id, dedup, 168):
            continue
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        addr = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
        summary = f"{tenant.full_name} at {addr} has no portal access — tenancy started {lease.start_date}"
        if not dry_run:
            _send_agent_alert(org_id, f"🔑 {summary}")
            _log_action(db, org_id, "tenant_portal_inactive", "tenant", tenant.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "tenant_portal_inactive", "summary": summary, "entity_id": tenant.id})
    return results


def check_survey_not_sent(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.maintenance import MaintenanceRequest
    from app.models.survey import MaintenanceSurvey
    from app.models.unit import Unit
    from app.models.property import Property
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    jobs = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        MaintenanceRequest.status == "completed",
        MaintenanceRequest.updated_at <= cutoff,
    ).all()
    for job in jobs:
        survey = db.query(MaintenanceSurvey).filter(MaintenanceSurvey.job_id == job.id).first()
        if survey:
            continue
        dedup = f"survey_not_sent:{job.id}"
        if _already_sent(db, org_id, dedup, 168):
            continue
        unit = db.query(Unit).join(Property).filter(Unit.id == job.unit_id).first()
        addr = unit.property.name if unit else "Unknown property"
        summary = f"No satisfaction survey sent for completed job #{job.id} '{job.title}' at {addr}"
        if not dry_run:
            _send_agent_alert(org_id, f"⭐ {summary}")
            _log_action(db, org_id, "survey_not_sent", "maintenance", job.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "survey_not_sent", "summary": summary, "entity_id": job.id})
    return results


def check_landlord_message_unread(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.portal_message import PortalMessage
    from app.models.landlord import Landlord
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    messages = db.query(PortalMessage).filter(
        PortalMessage.organisation_id == org_id,
        PortalMessage.sender_type == "landlord",
        PortalMessage.read == False,
        PortalMessage.created_at <= cutoff,
    ).all()
    for msg in messages:
        dedup = f"landlord_message_unread:{msg.id}"
        if _already_sent(db, org_id, dedup, 24):
            continue
        landlord = db.query(Landlord).filter(Landlord.id == msg.landlord_id).first()
        ll_name = landlord.full_name if landlord else "Landlord"
        preview = msg.body[:80] + ("…" if len(msg.body) > 80 else "")
        summary = f"Unread message from {ll_name} for {days}+ days: \"{preview}\""
        if not dry_run:
            _send_agent_alert(org_id, f"🏠 {summary}")
            _log_action(db, org_id, "landlord_message_unread", "portal_message", msg.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "landlord_message_unread", "summary": summary, "entity_id": msg.id})
    return results


def check_renewal_pending_too_long(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.renewal import LeaseRenewal
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.tenant import Tenant
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    renewals = db.query(LeaseRenewal).join(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        LeaseRenewal.status == "sent",
        LeaseRenewal.created_at <= cutoff,
    ).all()
    for renewal in renewals:
        dedup = f"renewal_pending_too_long:{renewal.id}"
        if _already_sent(db, org_id, dedup, 168):
            continue
        lease = db.query(Lease).filter(Lease.id == renewal.lease_id).first()
        if not lease:
            continue
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        t_name = tenant.full_name if tenant else "Tenant"
        addr = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
        summary = (f"Renewal offer for {t_name} at {addr} has been sent for {days}+ days "
                   f"with no response — proposed rent £{renewal.proposed_rent}/mo from {renewal.proposed_start}")
        if not dry_run:
            _send_agent_alert(org_id, f"📋 {summary}")
            _log_action(db, org_id, "renewal_pending_too_long", "renewal", renewal.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "renewal_pending_too_long", "summary": summary, "entity_id": renewal.id})
    return results


def check_vacant_unit_matches(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.applicant import Applicant
    from app.routers.applicants import _score_applicant
    results = []
    active_stages = ["enquiry", "viewing_booked", "viewed", "referencing", "approved"]
    vacant_units = db.query(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Unit.status == "vacant",
    ).all()
    applicants = db.query(Applicant).filter(
        Applicant.organisation_id == org_id,
        Applicant.status.in_(active_stages),
    ).all()
    for unit in vacant_units:
        prop = db.query(Property).filter(Property.id == unit.property_id).first()
        good_matches = []
        for a in applicants:
            m = _score_applicant(a, unit, prop)
            if m["pct"] >= 50:
                good_matches.append((a.full_name, m["pct"], m["reasons"]))
        if not good_matches:
            continue
        good_matches.sort(key=lambda x: x[1], reverse=True)
        dedup = f"vacant_unit_matches:{unit.id}"
        if _already_sent(db, org_id, dedup, 48):
            continue
        addr = f"{prop.name} · {unit.name}" if prop else unit.name
        top = good_matches[:3]
        names = ", ".join(f"{n} ({s}%)" for n, s, _ in top)
        summary = f"Vacant unit {addr} — {len(good_matches)} applicant match(es): {names}"
        if not dry_run:
            _send_agent_alert(org_id, f"🏠 {summary}")
            _log_action(db, org_id, "vacant_unit_matches", "unit", unit.id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "vacant_unit_matches", "summary": summary, "entity_id": unit.id})
    return results


def check_no_inspection(db: Session, org_id: int, days: int, agency_name: str, dry_run: bool) -> list:
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.tenant import Tenant
    from app.models.inspection import Inspection
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Lease.status == "active",
    ).all()
    for lease in leases:
        last_insp = db.query(Inspection).filter(
            Inspection.unit_id == lease.unit_id,
            Inspection.status == "completed",
        ).order_by(Inspection.scheduled_date.desc()).first()
        if last_insp and last_insp.scheduled_date >= cutoff.date():
            continue
        dedup = f"no_inspection:{lease.unit_id}"
        if _already_sent(db, org_id, dedup, 168):
            continue
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        t_name = tenant.full_name if tenant else "Tenant"
        addr = f"{unit.property.name} · {unit.name}" if unit else "Unknown"
        last = f"last inspection {last_insp.scheduled_date}" if last_insp else "no inspections on record"
        summary = f"{addr} ({t_name}) has not been inspected in {days}+ days — {last}"
        if not dry_run:
            _send_agent_alert(org_id, f"🏠 {summary}")
            _log_action(db, org_id, "no_inspection", "unit", lease.unit_id,
                        "agent_alert", "Agent", summary, None, dedup)
        results.append({"check": "no_inspection", "summary": summary, "entity_id": lease.unit_id})
    return results


# ── Registry ──────────────────────────────────────────────────────────────────

CHECK_REGISTRY = {
    "maintenance_unassigned":         check_maintenance_unassigned,
    "maintenance_stalled":            check_maintenance_stalled,
    "tenant_message_unanswered":      check_tenant_message_unanswered,
    "contractor_message_unanswered":  check_contractor_message_unanswered,
    "lease_expiring_no_offer":        check_lease_expiring_no_offer,
    "renewal_no_response":            check_renewal_no_response,
    "compliance_expiring":            check_compliance_expiring,
    "arrears_chase":                  check_arrears_chase,
    "applicant_followup_overdue":     check_applicant_followup_overdue,
    "applicant_stage_stalled":        check_applicant_stage_stalled,
    "applicant_referencing_stalled":  check_applicant_referencing_stalled,
    "deposit_not_registered":         check_deposit_not_registered,
    "inventory_missing_movein":       check_inventory_missing_movein,
    "tenant_portal_inactive":         check_tenant_portal_inactive,
    "survey_not_sent":                check_survey_not_sent,
    "landlord_message_unread":        check_landlord_message_unread,
    "renewal_pending_too_long":       check_renewal_pending_too_long,
    "no_inspection":                  check_no_inspection,
    "vacant_unit_matches":            check_vacant_unit_matches,
}


# ── Main runner ───────────────────────────────────────────────────────────────

def run_for_org(db: Session, org: Organisation, dry_run: bool = False) -> list:
    config = db.query(AutopilotConfig).filter(
        AutopilotConfig.organisation_id == org.id
    ).first()
    if not config or not config.enabled:
        return []

    checks_cfg = config.checks or {}
    all_results = []
    agency_name = org.name or "PropAIrty"

    for check_name, check_fn in CHECK_REGISTRY.items():
        check_cfg = checks_cfg.get(check_name, {})
        if not check_cfg.get("enabled", True):
            continue
        meta = CHECKS_META[check_name]
        days = check_cfg.get("days", meta["default_days"])
        try:
            results = check_fn(db, org.id, days, agency_name, dry_run)
            all_results.extend(results)
            if results:
                log.info(f"Org {org.id} — {check_name}: {len(results)} action(s)")
        except Exception as e:
            log.error(f"Org {org.id} — {check_name} failed: {e}")

    return all_results


def main():
    db = SessionLocal()
    try:
        orgs = db.query(Organisation).all()
        log.info(f"Running autopilot for {len(orgs)} organisation(s)")
        total = 0
        for org in orgs:
            results = run_for_org(db, org, dry_run=False)
            total += len(results)
        log.info(f"Autopilot complete — {total} total action(s) taken")
    finally:
        db.close()


if __name__ == "__main__":
    main()
