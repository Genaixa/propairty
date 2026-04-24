#!/usr/bin/env python3
"""
PropAIrty Demo Golem Swarm — simulates realistic daily activity across all portals.

Golems:
  - Tenant golems  : report maintenance, send messages, submit meter readings
  - Agent golem    : replies to messages, assigns jobs, updates statuses
  - Contractor golem: marks jobs in-progress, adds notes, completes jobs
  - Landlord golem : sends occasional messages to agent

Run 3× daily via cron:
  30 8  * * * cd /root/propairty/backend && PYTHONPATH=/root/propairty/backend python3 scripts/golem_swarm.py >> /var/log/propairty_golems.log 2>&1
  0  13 * * * cd /root/propairty/backend && PYTHONPATH=/root/propairty/backend python3 scripts/golem_swarm.py >> /var/log/propairty_golems.log 2>&1
  30 17 * * * cd /root/propairty/backend && PYTHONPATH=/root/propairty/backend python3 scripts/golem_swarm.py >> /var/log/propairty_golems.log 2>&1
"""
import sys, os, json, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, date, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [Golems] %(message)s')
log = logging.getLogger(__name__)

STATE_FILE = os.path.join(os.path.dirname(__file__), 'golem_state.json')
DEMO_ORG_ID = 1  # Tyne Lettings Ltd

# ── Tenant personas ───────────────────────────────────────────────────────────

PERSONAS = [
    { 'name': 'chatty',  'msg_prob': 0.22, 'maint_prob': 0.11, 'tone': 'friendly and chatty, slightly informal, uses exclamation marks occasionally' },
    { 'name': 'formal',  'msg_prob': 0.10, 'maint_prob': 0.07, 'tone': 'polite and professional, uses full sentences, signs off formally' },
    { 'name': 'terse',   'msg_prob': 0.07, 'maint_prob': 0.06, 'tone': 'brief and to the point, minimal words, no pleasantries' },
    { 'name': 'anxious', 'msg_prob': 0.18, 'maint_prob': 0.13, 'tone': 'slightly worried, provides lots of detail, asks follow-up questions' },
    { 'name': 'casual',  'msg_prob': 0.14, 'maint_prob': 0.09, 'tone': 'relaxed and friendly, uses contractions, laid-back tone' },
]

# ── Maintenance issue pool ────────────────────────────────────────────────────

MAINTENANCE_POOL = [
    { 'title': 'Dripping tap in kitchen',            'cat': 'plumbing',   'priority': 'low',    'contractor_trade': 'plumbing' },
    { 'title': 'Slow drain in bathroom',             'cat': 'plumbing',   'priority': 'low',    'contractor_trade': 'plumbing' },
    { 'title': 'Toilet not flushing properly',       'cat': 'plumbing',   'priority': 'medium', 'contractor_trade': 'plumbing' },
    { 'title': 'Radiator in bedroom not heating',    'cat': 'heating',    'priority': 'medium', 'contractor_trade': 'gas' },
    { 'title': 'Boiler making strange noise',        'cat': 'heating',    'priority': 'medium', 'contractor_trade': 'gas' },
    { 'title': 'Hot water intermittent',             'cat': 'heating',    'priority': 'high',   'contractor_trade': 'gas' },
    { 'title': 'Light fitting in hallway flickering','cat': 'electrical', 'priority': 'medium', 'contractor_trade': 'electrical' },
    { 'title': 'Socket in living room not working',  'cat': 'electrical', 'priority': 'medium', 'contractor_trade': 'electrical' },
    { 'title': 'Extractor fan in bathroom broken',   'cat': 'general',    'priority': 'low',    'contractor_trade': 'general' },
    { 'title': 'Damp patch on bedroom ceiling',      'cat': 'damp',       'priority': 'high',   'contractor_trade': 'general' },
    { 'title': 'Window handle broken in bedroom',    'cat': 'general',    'priority': 'low',    'contractor_trade': 'general' },
    { 'title': 'Front door stiff and hard to close', 'cat': 'general',    'priority': 'medium', 'contractor_trade': 'general' },
    { 'title': 'Mould appearing around window seals','cat': 'damp',       'priority': 'medium', 'contractor_trade': 'general' },
    { 'title': 'Letterbox not closing properly',     'cat': 'general',    'priority': 'low',    'contractor_trade': 'general' },
    { 'title': 'Kitchen tap dripping when off',      'cat': 'plumbing',   'priority': 'low',    'contractor_trade': 'plumbing' },
    { 'title': 'Pressure drop in shower',            'cat': 'plumbing',   'priority': 'medium', 'contractor_trade': 'plumbing' },
    { 'title': 'Cupboard door hinge broken',         'cat': 'general',    'priority': 'low',    'contractor_trade': 'general' },
    { 'title': 'Smoke alarm beeping intermittently', 'cat': 'electrical', 'priority': 'medium', 'contractor_trade': 'electrical' },
]

TENANT_MESSAGES = [
    "Just wanted to check — when is my next property inspection scheduled?",
    "Hi, could you let me know what day the bins are collected on? I've been missing them.",
    "Quick question — am I allowed to put up a small bookshelf with wall fixings?",
    "Can you confirm the procedure for ending my tenancy if I needed to give notice?",
    "Is there a way to get a spare key cut? I've lost one of mine.",
    "Just checking — is the garden maintenance my responsibility or the landlord's?",
    "Could you resend my tenancy agreement? I can't find my copy.",
    "When does my lease actually expire? I want to start planning ahead.",
    "Is parking included with the flat or do I need to arrange it separately?",
    "Can you let me know who the energy supplier is? I need to set up a direct debit.",
    "I had a parcel delivered to the wrong address — do you have any contact for the property manager?",
    "Just confirming my rent payment went through okay on the 1st?",
]

AGENT_REPLY_TEMPLATES = [
    "Thanks for getting in touch — we'll look into this and get back to you shortly.",
    "Hi, thanks for your message. Leave it with us and we'll come back to you within 24 hours.",
    "Thanks for letting us know. We'll follow this up and keep you posted.",
    "Noted — we'll get this sorted for you as soon as possible.",
    "Thanks for reaching out. We're on it and will update you shortly.",
]

CONTRACTOR_NOTES = {
    'plumbing': [
        "Attended site, identified issue. Will need to order part — returning within 3 days to complete.",
        "Assessed today. Minor repair required, will attend Thursday to complete.",
        "Part sourced and ordered. Estimated delivery 2 days, will book in completion visit.",
        "Attended and assessed. Straightforward repair, completing on next visit Friday.",
    ],
    'electrical': [
        "Attended today. Fault identified — awaiting replacement component, returning Monday.",
        "Inspected the installation. Safe to use in interim. Part on order, completing next week.",
        "Attended site. Minor fault found. Completing repair Thursday afternoon.",
        "Assessed. No immediate safety risk. Scheduling return visit to complete works.",
    ],
    'gas': [
        "Attended and carried out assessment. System safe and operational. Minor adjustment made.",
        "Boiler inspected — pressure issue identified and corrected on site. Monitoring recommended.",
        "Attended. Radiator valve replaced. System now working correctly.",
        "Attended and bled radiators. System pressure normalised. No further action required.",
    ],
    'general': [
        "Attended site today to assess. Works scheduled for completion this week.",
        "Inspected the issue. Materials sourced, returning to complete within 2 days.",
        "Assessed and minor repair completed on site. No further action required.",
        "Attended. Works require additional materials — returning Friday to complete.",
    ],
    'damp': [
        "Attended and assessed source of damp. Treatment recommended. Booking specialist.",
        "Inspected — minor condensation issue identified. Advice left with tenant. Monitoring.",
        "Damp assessed. Source identified as external — sealing works to be scheduled.",
        "Attended. Applied preliminary treatment. Booking follow-up inspection in 2 weeks.",
    ],
}

LANDLORD_MESSAGES = [
    "Hi, just checking in — any update on that maintenance job at the property?",
    "Could you send me the latest rent statement when you get a chance?",
    "Just wanted to check everything is running smoothly with the tenants?",
    "Is there anything I should be aware of coming up for renewals?",
    "Any compliance certificates due for renewal soon that I should know about?",
]

# ── Groq helper ───────────────────────────────────────────────────────────────

def _llm(prompt: str, max_tokens: int = 180) -> str | None:
    try:
        from openai import OpenAI
        from app.config import settings
        if not settings.groq_api_key:
            return None
        client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=settings.groq_api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        log.warning(f"Groq failed: {e}")
        return None


# ── State management ──────────────────────────────────────────────────────────

def load_state() -> dict:
    if os.path.exists(STATE_FILE):
        try:
            return json.load(open(STATE_FILE))
        except Exception:
            pass
    return {'tenants': {}, 'jobs': {}, 'landlords': {}, 'last_run': None}


def save_state(state: dict):
    state['last_run'] = datetime.now().isoformat()
    json.dump(state, open(STATE_FILE, 'w'), indent=2)


def days_since(date_str: str | None) -> int:
    if not date_str:
        return 9999
    try:
        d = date.fromisoformat(date_str[:10])
        return (date.today() - d).days
    except Exception:
        return 9999


def today_str() -> str:
    return date.today().isoformat()


# ── Tenant golem ──────────────────────────────────────────────────────────────

def run_tenant_golems(db: Session, state: dict, actions: list):
    from app.models.tenant import Tenant
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    from app.models.maintenance import MaintenanceRequest
    from app.models.tenant_message import TenantMessage
    from app.models.meter_reading import MeterReading

    tenants = db.query(Tenant).filter(Tenant.organisation_id == DEMO_ORG_ID).all()

    for tenant in tenants:
        ts = state['tenants'].setdefault(str(tenant.id), {})
        persona = PERSONAS[tenant.id % len(PERSONAS)]

        # Get active lease + unit
        lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == 'active').first()
        if not lease:
            continue
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
        if not unit:
            continue
        property_name = unit.property.name if unit.property else "the property"
        first_name = tenant.full_name.split()[0]

        # ── Maintenance report ──
        open_jobs = db.query(MaintenanceRequest).filter(
            MaintenanceRequest.reported_by_tenant_id == tenant.id,
            MaintenanceRequest.status.in_(['open', 'in_progress'])
        ).count()

        if (open_jobs == 0
                and days_since(ts.get('last_maintenance_reported')) >= 12
                and random.random() < persona['maint_prob']):

            issue = random.choice(MAINTENANCE_POOL)
            desc_prompt = f"""You are a UK tenant named {first_name}. Write a brief maintenance report message for: "{issue['title']}" at {property_name}.
Tone: {persona['tone']}. Max 2 sentences. Do not use markdown."""
            desc = _llm(desc_prompt, 100) or f"Hi, I wanted to report that {issue['title'].lower()} — could someone please take a look? Thanks."

            job = MaintenanceRequest(
                organisation_id=DEMO_ORG_ID,
                unit_id=unit.id,
                property_id=unit.property_id,
                title=issue['title'],
                description=desc,
                priority=issue['priority'],
                status='open',
                reported_by=tenant.full_name,
                reported_by_tenant_id=tenant.id,
            )
            db.add(job)
            db.flush()
            ts['last_maintenance_reported'] = today_str()
            ts.setdefault('open_issues', []).append(job.id)
            state['jobs'][str(job.id)] = {
                'stage': 'reported',
                'stage_entered': today_str(),
                'contractor_trade': issue['contractor_trade'],
                'notes_added': 0,
                'complete_target_days': random.randint(5, 10),
            }
            db.commit()
            actions.append(f"TENANT [{tenant.full_name}] reported: {issue['title']}")

        # ── Send message to agent ──
        unanswered = db.query(TenantMessage).filter(
            TenantMessage.tenant_id == tenant.id,
            TenantMessage.sender_type == 'tenant',
        ).order_by(TenantMessage.created_at.desc()).first()
        agent_replied = False
        if unanswered:
            agent_replied = db.query(TenantMessage).filter(
                TenantMessage.tenant_id == tenant.id,
                TenantMessage.sender_type == 'agent',
                TenantMessage.created_at >= unanswered.created_at,
            ).first() is not None

        if (days_since(ts.get('last_message_sent')) >= 3
                and (not unanswered or agent_replied)
                and random.random() < persona['msg_prob']):

            base_q = random.choice(TENANT_MESSAGES)
            msg_prompt = f"""You are a UK tenant named {first_name} at {property_name}. Rewrite this message in your own words:
"{base_q}"
Tone: {persona['tone']}. Max 2 sentences. Do not use markdown or lists."""
            body = _llm(msg_prompt, 100) or base_q

            db.add(TenantMessage(
                organisation_id=DEMO_ORG_ID,
                tenant_id=tenant.id,
                sender_type='tenant',
                sender_name=tenant.full_name,
                body=body,
                read=False,
            ))
            db.commit()
            ts['last_message_sent'] = today_str()
            actions.append(f"TENANT [{tenant.full_name}] sent message to agent")

        # ── Meter reading (1st–5th of month only) ──
        day_of_month = date.today().day
        if (1 <= day_of_month <= 5
                and days_since(ts.get('last_meter_reading')) >= 25
                and random.random() < 0.6):

            last_readings = ts.get('meter_readings', {'electricity': 14000.0, 'gas': 5200.0, 'water': 8100.0})
            for meter_type in ['electricity', 'gas', 'water']:
                increments = {'electricity': (180, 340), 'gas': (80, 180), 'water': (60, 130)}
                lo, hi = increments[meter_type]
                new_reading = round(last_readings.get(meter_type, 10000) + random.uniform(lo, hi), 1)
                db.add(MeterReading(
                    organisation_id=DEMO_ORG_ID,
                    tenant_id=tenant.id,
                    unit_id=unit.id,
                    meter_type=meter_type,
                    reading=new_reading,
                    reading_date=date.today(),
                    submitted_by='tenant',
                ))
                last_readings[meter_type] = new_reading
            db.commit()
            ts['last_meter_reading'] = today_str()
            ts['meter_readings'] = last_readings
            actions.append(f"TENANT [{tenant.full_name}] submitted meter readings")


# ── Agent golem ───────────────────────────────────────────────────────────────

def run_agent_golem(db: Session, state: dict, actions: list):
    from app.models.maintenance import MaintenanceRequest
    from app.models.tenant_message import TenantMessage
    from app.models.contractor import Contractor

    from sqlalchemy import text
    # Reply to unanswered tenant messages
    tenants_with_msgs = db.execute(
        text("SELECT DISTINCT tenant_id FROM tenant_messages WHERE organisation_id = :org AND sender_type = 'tenant'"),
        {'org': DEMO_ORG_ID}
    ).fetchall()

    for (tid,) in tenants_with_msgs:
        last_tenant = db.query(TenantMessage).filter(
            TenantMessage.organisation_id == DEMO_ORG_ID,
            TenantMessage.tenant_id == tid,
            TenantMessage.sender_type == 'tenant',
        ).order_by(TenantMessage.created_at.desc()).first()
        if not last_tenant:
            continue
        already_replied = db.query(TenantMessage).filter(
            TenantMessage.organisation_id == DEMO_ORG_ID,
            TenantMessage.tenant_id == tid,
            TenantMessage.sender_type == 'agent',
            TenantMessage.created_at >= last_tenant.created_at,
        ).first()
        if already_replied:
            continue
        if random.random() > 0.65:
            continue  # 65% chance agent replies this run

        reply_prompt = f"""You are a professional UK letting agent. Write a brief, helpful reply to this tenant message:
"{last_tenant.body}"
Tone: professional but friendly. Max 2 sentences. Sign off as "The Tyne Lettings Team". Do not use markdown."""
        body = _llm(reply_prompt, 120) or random.choice(AGENT_REPLY_TEMPLATES)

        db.add(TenantMessage(
            organisation_id=DEMO_ORG_ID,
            tenant_id=tid,
            sender_type='agent',
            sender_name='Tyne Lettings',
            body=body,
            read=False,
        ))
        db.commit()
        actions.append(f"AGENT replied to tenant message (tenant {tid})")

    # Assign unassigned maintenance jobs
    unassigned = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.organisation_id == DEMO_ORG_ID,
        MaintenanceRequest.status == 'open',
        MaintenanceRequest.contractor_id == None,
    ).all()

    # Prefer portal-enabled contractors
    contractors = db.query(Contractor).filter(
        Contractor.organisation_id == DEMO_ORG_ID,
        Contractor.portal_enabled == True,
    ).all()
    if not contractors:
        contractors = db.query(Contractor).filter(Contractor.organisation_id == DEMO_ORG_ID).all()

    for job in unassigned:
        js = state['jobs'].get(str(job.id), {})
        stage_age = days_since(js.get('stage_entered'))
        if stage_age < 1 and random.random() > 0.3:
            continue  # usually wait at least 1 day to assign
        if random.random() > 0.75:
            continue

        contractor = random.choice(contractors) if contractors else None
        if contractor:
            job.contractor_id = contractor.id
            job.assigned_to = contractor.company_name
            job.status = 'open'
            db.commit()
            state['jobs'].setdefault(str(job.id), {})
            state['jobs'][str(job.id)]['stage'] = 'assigned'
            state['jobs'][str(job.id)]['stage_entered'] = today_str()
            state['jobs'][str(job.id)]['contractor_id'] = contractor.id
            actions.append(f"AGENT assigned job #{job.id} '{job.title}' to {contractor.company_name}")


# ── Contractor golem ──────────────────────────────────────────────────────────

def run_contractor_golem(db: Session, state: dict, actions: list):
    from app.models.maintenance import MaintenanceRequest
    from app.models.maintenance_note import MaintenanceNote
    from app.models.contractor_message import ContractorMessage

    assigned_jobs = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.organisation_id == DEMO_ORG_ID,
        MaintenanceRequest.status.in_(['open', 'in_progress']),
        MaintenanceRequest.contractor_id != None,
    ).all()

    for job in assigned_jobs:
        js = state['jobs'].get(str(job.id), {})
        stage = js.get('stage', 'assigned')
        stage_age = days_since(js.get('stage_entered'))
        notes_added = js.get('notes_added', 0)
        complete_target = js.get('complete_target_days', 7)
        trade = js.get('contractor_trade', 'general')

        # Mark in_progress (1-2 days after assignment)
        if stage == 'assigned' and stage_age >= 1 and random.random() < 0.55:
            job.status = 'in_progress'
            db.commit()
            js['stage'] = 'in_progress'
            js['stage_entered'] = today_str()
            actions.append(f"CONTRACTOR marked job #{job.id} '{job.title}' in progress")

        # Add a note (in_progress, 1-3 days in, at most 2 notes)
        elif stage == 'in_progress' and stage_age >= 1 and notes_added < 2 and random.random() < 0.35:
            note_text = random.choice(CONTRACTOR_NOTES.get(trade, CONTRACTOR_NOTES['general']))
            try:
                note = MaintenanceNote(
                    maintenance_request_id=job.id,
                    author_type='contractor',
                    author_name='Contractor',
                    body=note_text,
                )
                db.add(note)
                db.commit()
            except Exception as e:
                log.warning(f"Could not add maintenance note: {e}")
                db.rollback()
            # Also update the job's updated_at so autopilot dedup resets
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
            js['notes_added'] = notes_added + 1
            actions.append(f"CONTRACTOR added note to job #{job.id}")

        # Complete job (after complete_target days in progress)
        elif stage == 'in_progress' and stage_age >= complete_target and random.random() < 0.5:
            job.status = 'completed'
            db.commit()
            js['stage'] = 'complete'
            js['stage_entered'] = today_str()
            actions.append(f"CONTRACTOR completed job #{job.id} '{job.title}'")


# ── Landlord golem ────────────────────────────────────────────────────────────

def run_landlord_golem(db: Session, state: dict, actions: list):
    from app.models.landlord import Landlord
    from app.models.portal_message import PortalMessage

    landlords = db.query(Landlord).filter(
        Landlord.organisation_id == DEMO_ORG_ID,
        Landlord.portal_enabled == True,
    ).all()

    for landlord in landlords:
        ls = state['landlords'].setdefault(str(landlord.id), {})
        if days_since(ls.get('last_message')) < 5:
            continue
        if random.random() > 0.08:  # 8% chance per run
            continue

        body = random.choice(LANDLORD_MESSAGES)

        try:
            db.add(PortalMessage(
                organisation_id=DEMO_ORG_ID,
                landlord_id=landlord.id,
                sender_type='landlord',
                body=body,
                read=False,
            ))
            db.commit()
            ls['last_message'] = today_str()
            actions.append(f"LANDLORD [{landlord.full_name}] sent message to agency")
        except Exception as e:
            log.warning(f"Landlord message failed: {e}")
            db.rollback()


# ── Payment golem ─────────────────────────────────────────────────────────────
#
# Rules:
#   - Most tenants pay within 1-3 days of due date (marked paid)
#   - LATE_PAYER_TENANT_ID always pays 5-8 days late (goes overdue first)
#   - On the 1st of each month, create next month's payment records
#   - Never touch payments more than 2 months in the future

LATE_PAYER_TENANT_ID = 1  # James Thorntons — always slightly late

def run_payment_golem(db: Session, state: dict, actions: list):
    from app.models.payment import RentPayment
    from app.models.lease import Lease
    from app.models.unit import Unit
    from app.models.property import Property
    from sqlalchemy.exc import IntegrityError
    import calendar

    today = date.today()

    # ── 1. Mark overdue payments as paid for on-time tenants ──────────────────
    # Find pending payments whose due_date has passed
    due_payments = (
        db.query(RentPayment)
        .join(Lease)
        .join(Unit)
        .join(Property)
        .filter(
            Property.organisation_id == DEMO_ORG_ID,
            RentPayment.status == 'pending',
            RentPayment.due_date <= today,
        )
        .all()
    )

    for pmt in due_payments:
        lease = db.query(Lease).filter(Lease.id == pmt.lease_id).first()
        if not lease:
            continue
        days_overdue = (today - pmt.due_date).days
        is_late_payer = lease.tenant_id == LATE_PAYER_TENANT_ID

        if is_late_payer:
            if days_overdue < 5:
                # Mark overdue so arrears show in the portal
                if pmt.status != 'overdue':
                    pmt.status = 'overdue'
                    db.commit()
                    actions.append(f"PAYMENT overdue: tenant {lease.tenant_id}, £{pmt.amount_due:.0f} due {pmt.due_date}")
            else:
                # Pay up after 5-8 days late
                paid_day = pmt.due_date + timedelta(days=random.randint(5, 8))
                if paid_day <= today:
                    pmt.status = 'paid'
                    pmt.amount_paid = pmt.amount_due
                    pmt.paid_date = paid_day
                    db.commit()
                    actions.append(f"PAYMENT late-paid: tenant {lease.tenant_id}, £{pmt.amount_due:.0f} (paid {paid_day})")
        else:
            # On-time tenants: pay within 1-3 days of due date
            pay_after = random.randint(0, 2)
            paid_day = pmt.due_date + timedelta(days=pay_after)
            if paid_day <= today:
                pmt.status = 'paid'
                pmt.amount_paid = pmt.amount_due
                pmt.paid_date = paid_day
                db.commit()
                actions.append(f"PAYMENT received: tenant {lease.tenant_id}, £{pmt.amount_due:.0f} (paid {paid_day})")

    # ── 2. Create next month's payment records on the 1st ─────────────────────
    if today.day != 1:
        return

    # Calculate next month's due date (last day of next month)
    if today.month == 12:
        next_month, next_year = 1, today.year + 1
    else:
        next_month, next_year = today.month + 1, today.year
    last_day = calendar.monthrange(next_year, next_month)[1]
    next_due = date(next_year, next_month, last_day)

    active_leases = (
        db.query(Lease)
        .join(Unit)
        .join(Property)
        .filter(
            Property.organisation_id == DEMO_ORG_ID,
            Lease.status == 'active',
            Lease.end_date >= next_due,
        )
        .all()
    )

    created = 0
    for lease in active_leases:
        existing = db.query(RentPayment).filter(
            RentPayment.lease_id == lease.id,
            RentPayment.due_date == next_due,
        ).first()
        if existing:
            continue
        try:
            db.add(RentPayment(
                lease_id=lease.id,
                due_date=next_due,
                amount_due=lease.monthly_rent,
                status='pending',
            ))
            db.commit()
            created += 1
        except IntegrityError:
            db.rollback()

    if created:
        actions.append(f"PAYMENT created {created} new payment record(s) for {next_due.strftime('%B %Y')}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    state = load_state()
    db = SessionLocal()
    actions = []

    try:
        run_tenant_golems(db, state, actions)
        run_agent_golem(db, state, actions)
        run_contractor_golem(db, state, actions)
        run_landlord_golem(db, state, actions)
        run_payment_golem(db, state, actions)
    except Exception as e:
        log.error(f"Golem swarm error: {e}", exc_info=True)
    finally:
        db.close()
        save_state(state)

    if actions:
        log.info(f"Golem run complete — {len(actions)} action(s):")
        for a in actions:
            log.info(f"  · {a}")
    else:
        log.info("Golem run complete — no actions taken this cycle")


if __name__ == '__main__':
    main()
