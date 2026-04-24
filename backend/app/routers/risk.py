"""
Rent arrears risk scoring — rule-based engine + AI portfolio narrative.
Scores each active tenant 1-5 based on payment history.
"""
import os
import json
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.lease import Lease
from app.models.payment import RentPayment
from app.models.unit import Unit
from app.models.property import Property

router = APIRouter(prefix="/api/risk", tags=["risk"])


def _score_tenant(lease: Lease, payments: list[RentPayment]) -> dict:
    """
    Rule-based risk scoring.
    Returns score 1 (low) to 5 (critical), factors list, recommendation.
    """
    today = date.today()
    monthly_rent = lease.monthly_rent
    tenant = lease.tenant

    # Analyse payment history
    paid_payments = [p for p in payments if p.status == "paid"]
    overdue_payments = [p for p in payments if p.status == "overdue"]
    partial_payments = [p for p in payments if p.status == "partial"]
    pending_due = [p for p in payments if p.status in ("pending", "overdue") and p.due_date <= today]

    # Days late for paid payments
    late_days_list = []
    for p in paid_payments:
        if p.paid_date and p.due_date and p.paid_date > p.due_date:
            late_days_list.append((p.paid_date - p.due_date).days)

    # Current arrears
    current_arrears = sum(
        (p.amount_due - (p.amount_paid or 0))
        for p in pending_due
    )

    # Score calculation (start 100, deduct)
    score = 100

    # Penalise late paid payments
    for days in late_days_list:
        if days <= 3:
            score -= 5
        elif days <= 7:
            score -= 10
        elif days <= 14:
            score -= 18
        elif days <= 30:
            score -= 25
        else:
            score -= 35

    # Penalise active overdue
    score -= len(overdue_payments) * 25

    # Penalise partial payments
    score -= len(partial_payments) * 12

    # Penalise current arrears
    if current_arrears >= monthly_rent * 2:
        score -= 50
    elif current_arrears >= monthly_rent:
        score -= 35
    elif current_arrears > 0:
        score -= 20

    score = max(0, min(100, score))

    # Trend: compare last 3 vs previous 3 payments
    sorted_paid = sorted(paid_payments, key=lambda p: p.due_date)
    def avg_lateness(ps):
        lates = []
        for p in ps:
            if p.paid_date and p.due_date and p.paid_date > p.due_date:
                lates.append((p.paid_date - p.due_date).days)
            else:
                lates.append(0)
        return sum(lates) / len(lates) if lates else 0

    trend = "stable"
    if len(sorted_paid) >= 6:
        old_avg = avg_lateness(sorted_paid[-6:-3])
        new_avg = avg_lateness(sorted_paid[-3:])
        if new_avg > old_avg + 2:
            trend = "worsening"
        elif new_avg < old_avg - 2:
            trend = "improving"
    elif len(sorted_paid) >= 3:
        pass  # not enough data for trend

    # Determine risk level from score
    if score >= 85:
        level, label, color = 1, "Low", "green"
    elif score >= 65:
        level, label, color = 2, "Low-Medium", "blue"
    elif score >= 45:
        level, label, color = 3, "Medium", "amber"
    elif score >= 25:
        level, label, color = 4, "High", "orange"
    else:
        level, label, color = 5, "Critical", "red"

    # Build factors
    factors = []
    total = len(payments)
    on_time = len([p for p in paid_payments if not any(
        p.paid_date and p.due_date and p.paid_date > p.due_date
        for _ in [None]
    )])
    # Recalculate on_time cleanly
    on_time = len([p for p in paid_payments if not (p.paid_date and p.due_date and p.paid_date > p.due_date)])

    if total == 0:
        factors.append("No payment history yet")
    else:
        if on_time > 0 and not late_days_list and not overdue_payments:
            factors.append(f"{on_time} payment{'s' if on_time != 1 else ''} on time")
        if late_days_list:
            avg_l = round(sum(late_days_list) / len(late_days_list))
            factors.append(f"{len(late_days_list)} late payment{'s' if len(late_days_list) != 1 else ''} (avg {avg_l} days)")
        if overdue_payments:
            factors.append(f"{len(overdue_payments)} overdue payment{'s' if len(overdue_payments) != 1 else ''}")
        if partial_payments:
            factors.append(f"{len(partial_payments)} partial payment{'s' if len(partial_payments) != 1 else ''}")
        if current_arrears > 0:
            factors.append(f"Current arrears: £{current_arrears:,.0f}")

    if trend == "worsening":
        factors.append("Payment trend: worsening")
    elif trend == "improving":
        factors.append("Payment trend: improving")

    # Recommendation
    if level == 1:
        recommendation = "No action needed"
    elif level == 2:
        recommendation = "Monitor — send friendly reminder if trend continues"
    elif level == 3:
        recommendation = "Send formal rent reminder"
    elif level == 4:
        recommendation = "Issue arrears warning letter — consider Section 8"
    else:
        recommendation = "Urgent: consider Section 8 notice or legal action"

    unit = lease.unit
    prop = unit.property if unit else None

    return {
        "tenant_id": tenant.id,
        "tenant_name": tenant.full_name,
        "tenant_email": tenant.email,
        "tenant_phone": tenant.phone,
        "lease_id": lease.id,
        "property": prop.name if prop else "Unknown",
        "unit": unit.name if unit else "Unknown",
        "monthly_rent": monthly_rent,
        "risk_score": level,
        "risk_label": label,
        "risk_color": color,
        "score_pct": score,
        "trend": trend,
        "factors": factors,
        "recommendation": recommendation,
        "stats": {
            "total_payments": total,
            "on_time": on_time,
            "late": len(late_days_list),
            "overdue": len(overdue_payments),
            "partial": len(partial_payments),
            "current_arrears": round(current_arrears, 2),
        },
    }


def _ai_portfolio_summary(risk_data: list[dict]) -> str:
    """Generate a brief AI narrative for the portfolio risk overview."""
    critical = [r for r in risk_data if r["risk_score"] >= 4]
    medium = [r for r in risk_data if r["risk_score"] == 3]
    low = [r for r in risk_data if r["risk_score"] <= 2]
    total_arrears = sum(r["stats"]["current_arrears"] for r in risk_data)

    in_arrears = [r for r in risk_data if r["stats"]["current_arrears"] > 0]
    prompt = (
        f"Portfolio risk summary: {len(risk_data)} active tenants. "
        f"{len(critical)} critical/high risk (based on payment history), {len(medium)} medium risk, {len(low)} low risk. "
        f"Total current arrears: £{total_arrears:,.0f}. "
    )
    if in_arrears:
        arrears_detail = ", ".join(
            f"{r['tenant_name']} (£{r['stats']['current_arrears']:,.0f})"
            for r in in_arrears[:3]
        )
        prompt += f"Tenants with current arrears: {arrears_detail}. "
    elif critical:
        names = ", ".join(r["tenant_name"] for r in critical[:3])
        prompt += f"High/critical risk tenants (late payments, no current arrears): {names}. "

    prompt += (
        "Write a 2-sentence plain-English portfolio risk briefing for the letting agent. "
        "Only mention arrears for tenants who actually have them. Be direct and actionable. No markdown."
    )

    try:
        from openai import OpenAI
        from app.config import settings
        if not settings.groq_api_key:
            return _fallback_summary(risk_data)
        client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=settings.groq_api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=120,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return _fallback_summary(risk_data)


def _portfolio_summary(risk_data: list[dict]) -> str:
    if not risk_data:
        return "No active tenants to assess."
    critical = [r for r in risk_data if r["risk_score"] >= 4]
    in_arrears = [r for r in risk_data if r["stats"]["current_arrears"] > 0]
    total_arrears = sum(r["stats"]["current_arrears"] for r in risk_data)

    if not critical and total_arrears == 0:
        return f"All {len(risk_data)} tenants are paying on time — portfolio is in good health."

    parts = []
    if in_arrears:
        arrears_names = ", ".join(
            f"{r['tenant_name']} (£{r['stats']['current_arrears']:,.0f})"
            for r in in_arrears[:3]
        )
        parts.append(f"current arrears of £{total_arrears:,.0f} from {arrears_names}")
    if critical:
        critical_no_arrears = [r for r in critical if r["stats"]["current_arrears"] == 0]
        if critical_no_arrears:
            names = ", ".join(r["tenant_name"] for r in critical_no_arrears[:3])
            parts.append(f"{len(critical_no_arrears)} high-risk tenant{'s' if len(critical_no_arrears) > 1 else ''} with poor payment history ({names})")
    return ("Your portfolio has " + " and ".join(parts) + ". Immediate follow-up is recommended."
            if parts else f"{len(risk_data)} active tenants assessed — monitor closely.")


@router.get("")
def get_risk_scores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return risk scores for all active tenants."""
    leases = (
        db.query(Lease)
        .join(Unit)
        .join(Property)
        .filter(
            Lease.status == "active",
            Property.organisation_id == current_user.organisation_id,
        )
        .all()
    )

    scored = []
    for lease in leases:
        payments = db.query(RentPayment).filter(RentPayment.lease_id == lease.id).all()
        scored.append(_score_tenant(lease, payments))

    # Deduplicate by tenant — keep worst (highest) risk score per tenant
    seen = {}
    for r in scored:
        tid = r["tenant_id"]
        if tid not in seen or r["risk_score"] > seen[tid]["risk_score"]:
            seen[tid] = r
    results = list(seen.values())

    # Sort: critical first
    results.sort(key=lambda r: (-r["risk_score"], r["tenant_name"]))

    summary = _portfolio_summary(results)

    return {
        "tenants": results,
        "summary": summary,
        "counts": {
            "critical": len([r for r in results if r["risk_score"] == 5]),
            "high": len([r for r in results if r["risk_score"] == 4]),
            "medium": len([r for r in results if r["risk_score"] == 3]),
            "low_medium": len([r for r in results if r["risk_score"] == 2]),
            "low": len([r for r in results if r["risk_score"] == 1]),
        },
        "total_arrears": round(sum(r["stats"]["current_arrears"] for r in results), 2),
    }
