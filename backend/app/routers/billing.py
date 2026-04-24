"""
Agent subscription billing via Stripe.
Agents pay a monthly subscription to access PropAIrty.
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.organisation import Organisation
from app.models.user import User
from app.config import settings
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/billing", tags=["billing"])

TRIAL_DAYS = 14


def _stripe():
    try:
        import stripe
        stripe.api_key = settings.stripe_secret_key
        return stripe
    except ImportError:
        raise HTTPException(status_code=503, detail="Stripe not available")


def _get_org(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Organisation:
    org = db.query(Organisation).filter(Organisation.id == user.organisation_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return org


@router.get("/status")
def billing_status(org: Organisation = Depends(_get_org)):
    """Return current subscription status for the agent's organisation."""
    now = datetime.now(timezone.utc)
    trial_active = (
        org.subscription_status == "trialing"
        and org.trial_ends_at
        and org.trial_ends_at.replace(tzinfo=timezone.utc) > now
    )
    trial_days_left = None
    if trial_active and org.trial_ends_at:
        trial_days_left = (org.trial_ends_at.replace(tzinfo=timezone.utc) - now).days

    return {
        "status": org.subscription_status,
        "trial_active": trial_active,
        "trial_days_left": trial_days_left,
        "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        "stripe_configured": bool(settings.stripe_secret_key),
        "has_subscription": bool(org.stripe_subscription_id),
    }


@router.post("/checkout")
def create_checkout(
    request: Request,
    org: Organisation = Depends(_get_org),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for the monthly subscription."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    if not settings.stripe_price_id:
        raise HTTPException(status_code=503, detail="Stripe price ID not configured")

    stripe = _stripe()
    base = settings.app_base_url

    # Reuse existing Stripe customer or create one
    customer_id = org.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=org.email or "",
            name=org.name,
            metadata={"organisation_id": str(org.id)},
        )
        customer_id = customer.id
        org.stripe_customer_id = customer_id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=f"{base}/settings?billing=success",
        cancel_url=f"{base}/settings?billing=cancelled",
        subscription_data={"metadata": {"organisation_id": str(org.id)}},
    )
    return {"checkout_url": session.url}


@router.post("/portal")
def billing_portal(org: Organisation = Depends(_get_org)):
    """Create a Stripe Customer Portal session (manage card, cancel, view invoices)."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    if not org.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found — subscribe first")

    stripe = _stripe()
    session = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=f"{settings.app_base_url}/settings",
    )
    return {"portal_url": session.url}


@router.post("/webhook")
async def subscription_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe webhook handler for subscription lifecycle events.
    Register this endpoint in the Stripe dashboard:
      https://propairty.co.uk/api/billing/webhook
    Events: customer.subscription.created, updated, deleted
            invoice.payment_failed
    """
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    import stripe
    stripe.api_key = settings.stripe_secret_key

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    obj = event["data"]["object"]

    if event["type"] in ("customer.subscription.created", "customer.subscription.updated"):
        org_id = obj.get("metadata", {}).get("organisation_id")
        if org_id:
            org = db.query(Organisation).filter(Organisation.id == int(org_id)).first()
            if org:
                org.stripe_subscription_id = obj["id"]
                org.subscription_status = obj["status"]  # active, past_due, canceled, trialing
                db.commit()

    elif event["type"] == "customer.subscription.deleted":
        org_id = obj.get("metadata", {}).get("organisation_id")
        if org_id:
            org = db.query(Organisation).filter(Organisation.id == int(org_id)).first()
            if org:
                org.subscription_status = "canceled"
                db.commit()

    elif event["type"] == "invoice.payment_failed":
        customer_id = obj.get("customer")
        if customer_id:
            org = db.query(Organisation).filter(Organisation.stripe_customer_id == customer_id).first()
            if org:
                org.subscription_status = "past_due"
                db.commit()

    return {"received": True}
