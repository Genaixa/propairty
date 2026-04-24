"""
Workflow rules engine — configurable triggers that fire daily.

Trigger types:
  rent_overdue          - email tenant when rent is N days overdue
  lease_expiring        - email tenant N days before lease ends
  maintenance_stale     - alert agent when job is open for N days
  viewing_reminder      - email applicant 24h before viewing
  inspection_upcoming   - email tenant N days before inspection
  ppm_due               - alert agent N days before PPM task due
  deposit_unprotected   - alert agent N days after deposit received unprotected

Actions:
  email_tenant      - send email to affected tenant / applicant
  email_landlord    - send email to property landlord
  telegram_agent    - send Telegram alert to agent
"""
from datetime import date, timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import html

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.workflow import WorkflowRule
from app.models.payment import RentPayment
from app.models.lease import Lease
from app.models.unit import Unit
from app.models.property import Property
from app.models.maintenance import MaintenanceRequest
from app.models.applicant import Applicant
from app.models.inspection import Inspection
from app.models.ppm import PPMSchedule
from app.models.deposit import TenancyDeposit
from app.models.landlord import Landlord
from app import notifications, emails

router = APIRouter(prefix="/api/workflows", tags=["workflows"])

TRIGGER_META = {
    "rent_overdue":          {"label": "Rent overdue",             "unit": "days after due",     "default_days": 3,  "default_action": "email_tenant"},
    "lease_expiring":        {"label": "Lease expiring",           "unit": "days before end",    "default_days": 60, "default_action": "email_tenant"},
    "maintenance_stale":     {"label": "Maintenance open too long","unit": "days open",          "default_days": 7,  "default_action": "telegram_agent"},
    "viewing_reminder":      {"label": "Viewing reminder",         "unit": "hours before",       "default_days": 1,  "default_action": "email_tenant"},
    "inspection_upcoming":   {"label": "Inspection upcoming",      "unit": "days before",        "default_days": 3,  "default_action": "email_tenant"},
    "ppm_due":               {"label": "PPM task due soon",        "unit": "days before due",    "default_days": 7,  "default_action": "telegram_agent"},
    "deposit_unprotected":   {"label": "Deposit unprotected",      "unit": "days after received","default_days": 14, "default_action": "telegram_agent"},
}


def _rule_out(r: WorkflowRule) -> dict:
    meta = TRIGGER_META.get(r.trigger, {})
    return {
        "id": r.id,
        "name": r.name,
        "trigger": r.trigger,
        "trigger_label": meta.get("label", r.trigger),
        "trigger_unit": meta.get("unit", "days"),
        "trigger_days": r.trigger_days,
        "action": r.action,
        "is_active": r.is_active,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


class RuleCreate(BaseModel):
    name: str
    trigger: str
    trigger_days: int
    action: str
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    trigger: Optional[str] = None
    trigger_days: Optional[int] = None
    action: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
def list_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rules = db.query(WorkflowRule).filter(
        WorkflowRule.organisation_id == current_user.organisation_id
    ).order_by(WorkflowRule.id).all()
    return [_rule_out(r) for r in rules]


@router.post("")
def create_rule(data: RuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.trigger not in TRIGGER_META:
        raise HTTPException(status_code=400, detail=f"Unknown trigger: {data.trigger}")
    rule = WorkflowRule(
        organisation_id=current_user.organisation_id,
        name=data.name,
        trigger=data.trigger,
        trigger_days=data.trigger_days,
        action=data.action,
        is_active=data.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_out(rule)


@router.put("/{rule_id}")
def update_rule(rule_id: int, data: RuleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(WorkflowRule).filter(
        WorkflowRule.id == rule_id,
        WorkflowRule.organisation_id == current_user.organisation_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return _rule_out(rule)


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(WorkflowRule).filter(
        WorkflowRule.id == rule_id,
        WorkflowRule.organisation_id == current_user.organisation_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}


@router.get("/triggers")
def list_triggers(current_user: User = Depends(get_current_user)):
    return [
        {"trigger": k, **{kk: vv for kk, vv in v.items()}}
        for k, v in TRIGGER_META.items()
    ]


@router.post("/seed-defaults")
def seed_defaults(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Seed the standard set of rules for a new organisation."""
    existing = db.query(WorkflowRule).filter(
        WorkflowRule.organisation_id == current_user.organisation_id
    ).count()
    if existing > 0:
        raise HTTPException(status_code=400, detail="Rules already exist for this organisation")

    defaults = [
        ("Rent overdue — email tenant",         "rent_overdue",         3,  "email_tenant"),
        ("Rent overdue 7 days — agent alert",   "rent_overdue",         7,  "telegram_agent"),
        ("Lease expiring 60 days — email tenant","lease_expiring",      60, "email_tenant"),
        ("Maintenance open 7 days — alert",     "maintenance_stale",    7,  "telegram_agent"),
        ("Viewing reminder 24h before",         "viewing_reminder",     1,  "email_tenant"),
        ("Inspection upcoming 3 days",          "inspection_upcoming",  3,  "email_tenant"),
        ("PPM due in 7 days — alert",           "ppm_due",              7,  "telegram_agent"),
        ("Deposit unprotected 14 days — alert", "deposit_unprotected",  14, "telegram_agent"),
    ]
    for name, trigger, days, action in defaults:
        db.add(WorkflowRule(
            organisation_id=current_user.organisation_id,
            name=name, trigger=trigger, trigger_days=days, action=action, is_active=True,
        ))
    db.commit()
    return {"ok": True, "created": len(defaults)}


# ─── Daily runner (called from scheduler) ────────────────────────────────────

def run_workflows(db: Session):
    """Execute all active workflow rules. Called once daily from the scheduler."""
    today = date.today()
    now = datetime.now(timezone.utc)

    rules = db.query(WorkflowRule).filter(WorkflowRule.is_active == True).all()

    for rule in rules:
        try:
            _run_rule(rule, today, now, db)
        except Exception as e:
            print(f"[workflow] rule {rule.id} ({rule.trigger}) error: {e}")


def _run_rule(rule: WorkflowRule, today: date, now: datetime, db: Session):
    org_id = rule.organisation_id
    days = rule.trigger_days

    if rule.trigger == "rent_overdue":
        # Payments overdue by exactly `days` days
        target_due = today - timedelta(days=days)
        payments = db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
            Property.organisation_id == org_id,
            RentPayment.due_date == target_due,
            RentPayment.status.in_(["overdue", "partial", "pending"]),
            RentPayment.amount_paid < RentPayment.amount_due,
        ).all()
        for p in payments:
            lease = p.lease
            if not lease or not lease.tenant:
                continue
            tenant = lease.tenant
            unit = lease.unit
            prop = unit.property if unit else None
            if rule.action == "email_tenant" and tenant.email:
                _email_rent_overdue(tenant, p, prop, unit, days)
            elif rule.action == "telegram_agent":
                notifications.send(
                    f"⚠️ <b>Workflow: Rent Overdue {days} Days</b>\n\n"
                    f"Tenant: {tenant.full_name}\n"
                    f"Property: {prop.name + ' · ' + unit.name if prop and unit else '—'}\n"
                    f"Amount: £{p.amount_due - (p.amount_paid or 0):.2f}\n"
                    f"Due: {p.due_date.strftime('%-d %B %Y')}"
                )

    elif rule.trigger == "lease_expiring":
        target_end = today + timedelta(days=days)
        leases = db.query(Lease).join(Unit).join(Property).filter(
            Property.organisation_id == org_id,
            Lease.status == "active",
            Lease.end_date == target_end,
        ).all()
        for lease in leases:
            tenant = lease.tenant
            unit = lease.unit
            prop = unit.property if unit else None
            if rule.action == "email_tenant" and tenant and tenant.email:
                _email_lease_expiring(tenant, lease, prop, unit, days)
            elif rule.action == "email_landlord":
                _email_landlord_expiring(lease, prop, unit, days, db)
            elif rule.action == "telegram_agent":
                notifications.send(
                    f"🔄 <b>Workflow: Lease Expiring in {days} Days</b>\n\n"
                    f"Tenant: {tenant.full_name if tenant else '—'}\n"
                    f"Property: {prop.name + ' · ' + unit.name if prop and unit else '—'}\n"
                    f"End date: {lease.end_date.strftime('%-d %B %Y')}"
                )

    elif rule.trigger == "maintenance_stale":
        open_since = today - timedelta(days=days)
        jobs = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
            Property.organisation_id == org_id,
            MaintenanceRequest.status.in_(["open", "in_progress"]),
        ).all()
        stale = [j for j in jobs if j.created_at and j.created_at.date() == open_since]
        for j in stale:
            unit = j.unit
            prop = unit.property if unit else None
            notifications.send(
                f"🔧 <b>Workflow: Maintenance Stale {days} Days</b>\n\n"
                f"Job: {j.title}\n"
                f"Property: {prop.name + ' · ' + unit.name if prop and unit else '—'}\n"
                f"Priority: {j.priority or '—'}\n"
                f"Status: {j.status}"
            )

    elif rule.trigger == "viewing_reminder":
        # Email applicants whose viewing is in exactly ~24h (tomorrow same hour)
        window_start = now + timedelta(hours=23)
        window_end = now + timedelta(hours=25)
        applicants = db.query(Applicant).filter(
            Applicant.organisation_id == org_id,
            Applicant.viewing_date >= window_start,
            Applicant.viewing_date <= window_end,
            Applicant.viewing_reminder_sent != True,
            Applicant.status == "viewing_booked",
        ).all()
        for a in applicants:
            if rule.action in ("email_tenant", "email_landlord") and a.email:
                _email_viewing_reminder(a)
                a.viewing_reminder_sent = True
        if applicants:
            db.commit()

    elif rule.trigger == "inspection_upcoming":
        target_date = today + timedelta(days=days)
        inspections = db.query(Inspection).join(Unit).join(Property).filter(
            Property.organisation_id == org_id,
            Inspection.status == "scheduled",
            Inspection.scheduled_date == target_date,
        ).all()
        for insp in inspections:
            unit = insp.unit
            prop = unit.property if unit else None
            lease = db.query(Lease).filter(Lease.unit_id == unit.id, Lease.status == "active").first() if unit else None
            tenant = lease.tenant if lease else None
            if rule.action == "email_tenant" and tenant and tenant.email:
                _email_inspection_reminder(tenant, insp, prop, unit, days)
            elif rule.action == "telegram_agent":
                notifications.send(
                    f"🔍 <b>Workflow: Inspection in {days} Days</b>\n\n"
                    f"Property: {prop.name + ' · ' + unit.name if prop and unit else '—'}\n"
                    f"Type: {insp.type.replace('_', ' ').title()}\n"
                    f"Date: {insp.scheduled_date.strftime('%-d %B %Y')}"
                )

    elif rule.trigger == "ppm_due":
        target_date = today + timedelta(days=days)
        tasks = db.query(PPMSchedule).join(Property).filter(
            Property.organisation_id == org_id,
            PPMSchedule.is_active == True,
            PPMSchedule.next_due == target_date,
        ).all()
        for t in tasks:
            prop = t.property
            notifications.send(
                f"🗓️ <b>Workflow: PPM Due in {days} Days</b>\n\n"
                f"Task: {t.title}\n"
                f"Property: {prop.name if prop else '—'}\n"
                f"Due: {t.next_due.strftime('%-d %B %Y')}"
            )

    elif rule.trigger == "deposit_unprotected":
        target_received = today - timedelta(days=days)
        deposits = db.query(TenancyDeposit).join(Lease).join(Unit).join(Property).filter(
            Property.organisation_id == org_id,
            TenancyDeposit.status == "unprotected",
            TenancyDeposit.received_date == target_received,
        ).all()
        for d in deposits:
            lease = d.lease
            tenant = lease.tenant if lease else None
            unit = lease.unit if lease else None
            prop = unit.property if unit else None
            notifications.send(
                f"🏦 <b>Workflow: Deposit Unprotected {days} Days</b>\n\n"
                f"Tenant: {tenant.full_name if tenant else '—'}\n"
                f"Property: {prop.name + ' · ' + unit.name if prop and unit else '—'}\n"
                f"Amount: £{d.amount:.2f}\n"
                f"Received: {d.received_date.strftime('%-d %B %Y')}\n"
                f"⚠️ Must be protected within 30 days of receipt"
            )


# ─── Email helpers ─────────────────────────────────────────────────────────────

def _email_rent_overdue(tenant, payment, prop, unit, days):
    subject = f"Rent overdue — {days} days"
    first = html.escape(tenant.full_name.split()[0])
    property_str = html.escape(f"{prop.name}, {unit.name}") if prop and unit else "your property"
    amount = payment.amount_due - (payment.amount_paid or 0)
    body = f"""
    <h2>Overdue Rent Notice</h2>
    <p>Hi {first},</p>
    <p>Your rent is now <strong>{days} days overdue</strong> for {property_str}.</p>
    <div class="amount-box">
      <div class="label">Amount Outstanding</div>
      <div class="amount">£{amount:.2f}</div>
    </div>
    <p>Please arrange payment as soon as possible or contact your letting agent to discuss.</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">Pay now in your portal</a>
    """
    emails._send_email(tenant.email, subject, emails._base_template(subject, body, "PropAIrty"))


def _email_lease_expiring(tenant, lease, prop, unit, days):
    subject = f"Your tenancy ends in {days} days"
    first = html.escape(tenant.full_name.split()[0])
    property_str = html.escape(f"{prop.name}, {unit.name}") if prop and unit else "your property"
    end_str = lease.end_date.strftime("%-d %B %Y")
    body = f"""
    <h2>Tenancy Renewal Reminder</h2>
    <p>Hi {first},</p>
    <p>Your tenancy at <strong>{property_str}</strong> is due to end on <strong>{end_str}</strong> — that's {days} days away.</p>
    <p>If you'd like to renew, please contact your letting agent or check your portal for a renewal offer.</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">View your portal</a>
    """
    emails._send_email(tenant.email, subject, emails._base_template(subject, body, "PropAIrty"))


def _email_landlord_expiring(lease, prop, unit, days, db):
    if not prop or not prop.landlord_id:
        return
    from app.models.landlord import Landlord as LandlordModel
    landlord = db.query(LandlordModel).filter(LandlordModel.id == prop.landlord_id).first()
    if not landlord or not landlord.email:
        return
    tenant = lease.tenant
    subject = f"Lease expiring in {days} days — {prop.name}"
    first = html.escape(landlord.full_name.split()[0])
    body = f"""
    <h2>Lease Expiry Notice</h2>
    <p>Hi {first},</p>
    <p>A tenancy in your portfolio is expiring in <strong>{days} days</strong>.</p>
    <div class="amount-box">
      <div class="label">Property</div>
      <div class="amount" style="font-size:18px">{html.escape(prop.name + ' · ' + unit.name if unit else prop.name)}</div>
    </div>
    <p><strong>Tenant:</strong> {html.escape(tenant.full_name if tenant else '—')}</p>
    <p><strong>End date:</strong> {lease.end_date.strftime('%-d %B %Y')}</p>
    <p>Your letting agent will be in touch regarding renewal options.</p>
    <a href="https://propairty.co.uk/landlord/portal" class="cta">View landlord portal</a>
    """
    emails._send_email(landlord.email, subject, emails._base_template(subject, body, "PropAIrty"))


def _email_viewing_reminder(applicant):
    subject = "Reminder: your property viewing is tomorrow"
    first = html.escape(applicant.full_name.split()[0])
    vdate = applicant.viewing_date.strftime("%-d %B %Y at %-I:%M %p") if applicant.viewing_date else "tomorrow"
    prop_str = ""
    if applicant.property:
        p = applicant.property
        addr = html.escape(f"{p.address_line1}, {p.city}")
        prop_str = f"<p><strong>Address:</strong> {addr}</p>"
    body = f"""
    <h2>Viewing Reminder</h2>
    <p>Hi {first},</p>
    <p>This is a reminder that your property viewing is scheduled for <strong>{vdate}</strong>.</p>
    {prop_str}
    <p>If you need to rearrange or have any questions, please contact us as soon as possible.</p>
    """
    emails._send_email(applicant.email, subject, emails._base_template(subject, body, "PropAIrty"))


def _email_inspection_reminder(tenant, inspection, prop, unit, days):
    subject = f"Inspection in {days} days — {inspection.scheduled_date.strftime('%-d %B %Y')}"
    first = html.escape(tenant.full_name.split()[0])
    property_str = html.escape(f"{prop.name}, {unit.name}") if prop and unit else "your property"
    date_str = inspection.scheduled_date.strftime("%-d %B %Y")
    type_label = inspection.type.replace("_", " ").title()
    body = f"""
    <h2>Upcoming Inspection — {days} Day Reminder</h2>
    <p>Hi {first},</p>
    <p>A <strong>{type_label}</strong> inspection of <strong>{property_str}</strong> is scheduled for <strong>{date_str}</strong>.</p>
    <p>Please ensure the property is accessible. If you need to rearrange, contact your letting agent.</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">View your portal</a>
    """
    emails._send_email(tenant.email, subject, emails._base_template(subject, body, "PropAIrty"))
