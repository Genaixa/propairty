import os
import json
import html
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.database import Base, engine, SessionLocal
from app.routers import auth, properties, tenants, leases, maintenance, dashboard, payments, compliance, documents, onboarding
from app.routers import ai, alerts, landlord, tenant_portal, news, stripe_payments, contractors, inspections, risk, renewals, uploads, analytics, dispatch, deposits, accounting, applicants, notices, inventory, valuation, contractor_portal, ppm, billing, public_site, intelligence, phone, right_to_rent, surveys, email_inbound, system_settings, signing, workflows, checklists, audit_trail, feature_flags, cfo, autopilot, mtd
from app import notifications, emails, escalation, wendy

# Load env from openclaw config if not already set
_cfg_path = "/root/.openclaw/openclaw.json"
if os.path.exists(_cfg_path):
    try:
        cfg = json.load(open(_cfg_path))
        env = cfg.get("env", {})
        for key in ("ANTHROPIC_API_KEY", "MISTRAL_API_KEY"):
            if not os.environ.get(key) and env.get(key):
                os.environ[key] = env[key]
    except Exception:
        pass

# Telegram from chambers workspace env
_chambers_env = "/root/.openclaw/workspace-chambers/.env"
if os.path.exists(_chambers_env):
    for line in open(_chambers_env):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            if k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID") and not os.environ.get(k):
                os.environ[k] = v
                notifications.BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
                notifications.CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")


def daily_check():
    db = SessionLocal()
    try:
        notifications.run_daily_checks(db)
        emails.run_rent_reminders(db)
        emails.send_agent_renewal_reminders(db)
        emails.send_agent_compliance_reminders(db)
        dispatch.run_auto_dispatch(db)
        deposits.check_deposit_compliance(db)
        escalation.run_escalation(db)
        ppm.run_ppm_check(db)
        workflows.run_workflows(db)
    finally:
        db.close()


def daily_news_refresh():
    try:
        news.refresh_cache()
    except Exception:
        pass


def snapshot_daily_metrics():
    """Snapshot key portfolio metrics for every org — enables Mendy trend analysis."""
    from datetime import date, timedelta
    from app.models.organisation import Organisation
    from app.models.metric_snapshot import MetricSnapshot
    from app.models.property import Property
    from app.models.unit import Unit
    from app.models.lease import Lease
    from app.models.payment import RentPayment
    from app.models.compliance import ComplianceCertificate
    from app.models.maintenance import MaintenanceRequest
    from app.models.applicant import Applicant
    db = SessionLocal()
    try:
        today = date.today()
        orgs = db.query(Organisation).all()
        for org in orgs:
            oid = org.id
            lease_ids = db.query(Lease.id).join(Unit).join(Property).filter(Property.organisation_id == oid)
            overdue_rows = db.query(RentPayment).filter(
                RentPayment.lease_id.in_(lease_ids), RentPayment.status == "overdue"
            ).all()
            now = today
            data = {
                "properties": db.query(Property).filter(Property.organisation_id == oid).count(),
                "units": db.query(Unit).join(Property).filter(Property.organisation_id == oid).count(),
                "vacant_units": db.query(Unit).join(Property).filter(Property.organisation_id == oid, Unit.status == "vacant").count(),
                "active_leases": db.query(Lease).join(Unit).join(Property).filter(Property.organisation_id == oid, Lease.status == "active").count(),
                "overdue_rent_count": len(overdue_rows),
                "overdue_rent_amount": float(sum((r.amount or 0) - (r.amount_paid or 0) for r in overdue_rows)),
                "expired_certs": db.query(ComplianceCertificate).join(Property).filter(Property.organisation_id == oid, ComplianceCertificate.expiry_date < now).count(),
                "expiring_soon_certs": db.query(ComplianceCertificate).join(Property).filter(
                    Property.organisation_id == oid,
                    ComplianceCertificate.expiry_date >= now,
                    ComplianceCertificate.expiry_date <= now + timedelta(days=90)
                ).count(),
                "open_maintenance": db.query(MaintenanceRequest).filter(
                    MaintenanceRequest.organisation_id == oid,
                    MaintenanceRequest.status.in_(["open", "in_progress"])
                ).count(),
                "active_applicants": db.query(Applicant).filter(Applicant.organisation_id == oid, Applicant.status == "active").count(),
            }
            snap = db.query(MetricSnapshot).filter_by(organisation_id=oid, date=today).first()
            if snap:
                snap.data = data
            else:
                db.add(MetricSnapshot(organisation_id=oid, date=today, data=data))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def monthly_landlord_statements():
    """Run on the 1st of each month to email last month's statement to all landlords."""
    db = SessionLocal()
    try:
        emails.send_monthly_landlord_statements(db)
    finally:
        db.close()


scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run once on startup, then daily at 8am
    scheduler.add_job(daily_check, "cron", hour=8, minute=0, id="daily_checks")
    scheduler.add_job(daily_news_refresh, "interval", hours=1, id="news_refresh")
    # 1st of each month at 9am — email landlord statements for previous month
    scheduler.add_job(monthly_landlord_statements, "cron", day=1, hour=9, minute=0, id="landlord_statements")
    # Daily at noon — refresh Wendy's knowledge from git changes
    scheduler.add_job(wendy.refresh, "cron", hour=12, minute=0, id="wendy_refresh")
    scheduler.add_job(snapshot_daily_metrics, "cron", hour=23, minute=50, id="metric_snapshots")
    scheduler.start()
    # Warm caches immediately in background on startup
    threading.Thread(target=snapshot_daily_metrics, daemon=True).start()
    threading.Thread(target=daily_news_refresh, daemon=True).start()
    threading.Thread(target=wendy.load, daemon=True).start()
    yield
    scheduler.shutdown()


_DEFAULT_SECRET = "propairty-dev-secret-change-in-prod"
if __name__ != "__main__":  # guard runs in uvicorn, not test imports
    from app.config import settings as _s
    if _s.secret_key == _DEFAULT_SECRET:
        import warnings
        warnings.warn(
            "WARNING: Using default SECRET_KEY. Set SECRET_KEY in .env.production before going live.",
            stacklevel=1,
        )

# Schema is managed by Alembic migrations (alembic upgrade head).
# create_all() is intentionally removed so schema changes go through migrations.

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="PropAIrty API", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://72.62.210.21:8888", "https://propairty.co.uk", "https://www.propairty.co.uk"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(tenants.router)
app.include_router(leases.router)
app.include_router(maintenance.router)
app.include_router(dashboard.router)
app.include_router(payments.router)
app.include_router(compliance.router)
app.include_router(onboarding.router)
app.include_router(alerts.router)
app.include_router(documents.router)
app.include_router(ai.router)
app.include_router(landlord.router)
app.include_router(tenant_portal.router)
app.include_router(news.router)
app.include_router(stripe_payments.router)
app.include_router(contractors.router)
app.include_router(inspections.router)
app.include_router(risk.router)
app.include_router(renewals.router)
app.include_router(uploads.router)
app.include_router(analytics.router)
app.include_router(dispatch.router)
app.include_router(deposits.router)
app.include_router(accounting.router)
app.include_router(applicants.router)
app.include_router(notices.router)
app.include_router(inventory.router)
app.include_router(valuation.router)
app.include_router(contractor_portal.router)
app.include_router(ppm.router)
app.include_router(billing.router)
app.include_router(public_site.router)
app.include_router(intelligence.router)
app.include_router(phone.router)
app.include_router(right_to_rent.router)
app.include_router(surveys.router)
app.include_router(email_inbound.router)
app.include_router(system_settings.router)
app.include_router(signing.router)
app.include_router(workflows.router)
app.include_router(checklists.router)
app.include_router(audit_trail.router)
app.include_router(feature_flags.router)
app.include_router(cfo.router)
app.include_router(autopilot.router)
app.include_router(mtd.router)

# Serve uploaded files publicly (filenames are UUID-based, not guessable)
app.mount("/uploads", StaticFiles(directory="/root/propairty/uploads"), name="uploads")


@app.get("/")
def root():
    return {"app": "PropAIrty", "version": "0.1.0", "status": "running"}


from pydantic import BaseModel as _BM, field_validator

class DemoRequest(_BM):
    name: str
    email: str
    agency: str
    units: str
    message: str = ""

    @field_validator('name', 'email', 'agency', 'units')
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('must not be empty')
        return v.strip()

@app.post("/api/demo-request")
def demo_request(data: DemoRequest):
    body = f"""
<h2>New Demo Request — PropAIrty</h2>
<table>
<tr><td><strong>Name</strong></td><td>{html.escape(data.name)}</td></tr>
<tr><td><strong>Email</strong></td><td>{html.escape(data.email)}</td></tr>
<tr><td><strong>Agency</strong></td><td>{html.escape(data.agency)}</td></tr>
<tr><td><strong>Properties</strong></td><td>{html.escape(data.units)}</td></tr>
<tr><td><strong>Message</strong></td><td>{html.escape(data.message) if data.message else '—'}</td></tr>
</table>
"""
    emails._send_email("info@genaixa.co.uk", f"Demo request from {data.agency}", body)
    notifications.send(
        f"🔔 <b>New demo request</b>\n"
        f"<b>Name:</b> {data.name}\n"
        f"<b>Agency:</b> {data.agency}\n"
        f"<b>Email:</b> {data.email}\n"
        f"<b>Properties:</b> {data.units}\n"
        f"<b>Message:</b> {data.message or '—'}"
    )
    return {"ok": True}
