import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.database import get_db
from app.config import settings
from app.models.payment import RentPayment
from app.models.lease import Lease
from app.models.tenant import Tenant
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
from app.routers.tenant_portal import get_current_tenant
from app.auth import get_current_user
from app.models.user import User
from app import notifications, emails

router = APIRouter(prefix="/api/stripe", tags=["stripe"])


def get_stripe():
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured for this organisation yet.")
    stripe.api_key = settings.stripe_secret_key
    return stripe


# --- Tenant initiates checkout ---

@router.post("/checkout/{payment_id}")
def create_checkout(
    payment_id: int,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    get_stripe()

    # Verify payment belongs to this tenant
    leases = db.query(Lease).filter(Lease.tenant_id == tenant.id).all()
    lease_ids = [l.id for l in leases]
    payment = db.query(RentPayment).filter(
        RentPayment.id == payment_id,
        RentPayment.lease_id.in_(lease_ids),
        RentPayment.status != "paid",
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found or already paid")

    lease = db.query(Lease).filter(Lease.id == payment.lease_id).first()
    unit = db.query(Unit).filter(Unit.id == lease.unit_id).first()
    prop = db.query(Property).filter(Property.id == unit.property_id).first()
    org = db.query(Organisation).filter(Organisation.id == prop.organisation_id).first()

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "gbp",
                "unit_amount": int(payment.amount_due * 100),  # pence
                "product_data": {
                    "name": f"Rent — {prop.name}, {unit.name}",
                    "description": f"Due {payment.due_date.strftime('%d %B %Y')} · {org.name}",
                },
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{settings.app_base_url}/tenant/portal?payment=success",
        cancel_url=f"{settings.app_base_url}/tenant/portal?payment=cancelled",
        metadata={
            "payment_id": str(payment_id),
            "tenant_id": str(tenant.id),
        },
        customer_email=tenant.email,
    )

    return {"checkout_url": session.url, "session_id": session.id}


# --- Stripe webhook ---

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    get_stripe()
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        payment_id = int(session["metadata"]["payment_id"])
        amount_paid = session["amount_total"] / 100  # convert from pence

        payment = db.query(RentPayment).filter(RentPayment.id == payment_id).first()
        if payment and payment.status != "paid":
            payment.status = "paid"
            payment.amount_paid = amount_paid
            payment.paid_date = date.today()
            payment.stripe_session_id = session.get("id")
            db.commit()
            db.refresh(payment)

            # Send receipt email + Telegram alert
            try:
                lease = db.query(Lease).filter(Lease.id == payment.lease_id).first()
                tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
                unit = db.query(Unit).filter(Unit.id == lease.unit_id).first() if lease else None
                prop = db.query(Property).filter(Property.id == unit.property_id).first() if unit else None
                org = db.query(Organisation).filter(Organisation.id == prop.organisation_id).first() if prop else None
                if tenant and prop and unit and org:
                    emails.send_payment_receipt(tenant, payment, prop, unit, org)
                    notifications.send(
                        f"💳 <b>Online Rent Received</b>\n\n"
                        f"Tenant: {tenant.full_name}\n"
                        f"Property: {prop.name} · {unit.name}\n"
                        f"Amount: £{amount_paid:.2f}\n"
                        f"Period: {payment.due_date.strftime('%B %Y') if payment.due_date else '—'}"
                    )
            except Exception as e:
                print(f"[stripe webhook] post-payment notifications failed: {e}")

    return JSONResponse({"ok": True})


# --- Agent: get publishable key for frontend ---

@router.get("/config")
def stripe_config():
    return {"publishable_key": settings.stripe_publishable_key or ""}


# --- Agent: Stripe status ---

@router.get("/status")
def stripe_status(current_user: User = Depends(get_current_user)):
    configured = bool(settings.stripe_secret_key and settings.stripe_publishable_key)
    webhook_configured = bool(settings.stripe_webhook_secret)
    return {
        "configured": configured,
        "webhook_configured": webhook_configured,
        "publishable_key_set": bool(settings.stripe_publishable_key),
    }


# --- Agent: recent online payments ---

@router.get("/payments")
def list_online_payments(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payments = (
        db.query(RentPayment)
        .join(Lease)
        .join(Unit)
        .join(Property)
        .filter(
            Property.organisation_id == current_user.organisation_id,
            RentPayment.stripe_session_id.isnot(None),
        )
        .order_by(RentPayment.paid_date.desc())
        .limit(limit)
        .all()
    )
    result = []
    for p in payments:
        lease = p.lease
        unit = lease.unit if lease else None
        prop = unit.property if unit else None
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
        result.append({
            "id": p.id,
            "tenant_name": tenant.full_name if tenant else "—",
            "unit": f"{prop.name} · {unit.name}" if prop and unit else "—",
            "amount_paid": p.amount_paid,
            "due_date": p.due_date.isoformat() if p.due_date else None,
            "paid_date": p.paid_date.isoformat() if p.paid_date else None,
            "stripe_session_id": p.stripe_session_id,
        })
    return result
