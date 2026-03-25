import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.database import Base, engine, SessionLocal
from app.routers import auth, properties, tenants, leases, maintenance, dashboard, payments, compliance, documents, onboarding
from app.routers import ai, alerts, landlord, tenant_portal, news, stripe_payments, contractors, inspections, risk, renewals, uploads, analytics, dispatch, deposits, accounting, applicants, notices, inventory, valuation, contractor_portal, ppm
from app import notifications, emails, escalation

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
    finally:
        db.close()


def daily_news_refresh():
    try:
        news.refresh_cache()
    except Exception:
        pass


scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run once on startup, then daily at 8am
    scheduler.add_job(daily_check, "cron", hour=8, minute=0, id="daily_checks")
    scheduler.add_job(daily_news_refresh, "cron", hour=7, minute=30, id="news_refresh")
    scheduler.start()
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


@app.get("/")
def root():
    return {"app": "PropAIrty", "version": "0.1.0", "status": "running"}
