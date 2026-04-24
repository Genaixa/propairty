"""
CFO Dashboard — synthesises portfolio financials into ranked actions.

Combines existing data (rent payments, maintenance costs, leases, churn risk,
rent optimisation) into a single agency-perspective P&L view with prioritised
"push this / drop this" recommendations.

The agency makes money from management fees (% of rent collected) and incurs
soft costs handling maintenance jobs. We don't track per-property fee % yet,
so the endpoint takes `fee_pct` and `handling_cost_per_job` as query params
with sensible defaults (10% fee, £25 internal handling cost per job).
"""
from datetime import date, timedelta
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.property import Property
from app.models.unit import Unit
from app.models.lease import Lease
from app.models.payment import RentPayment
from app.models.maintenance import MaintenanceRequest
from app.models.tenant import Tenant
from app.models.renewal import LeaseRenewal
from app.models.landlord import Landlord
from app.models.organisation import Organisation
from app import docgen, emails as _emails

router = APIRouter(prefix="/api/cfo", tags=["cfo"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _months_back(n: int):
    """Yield (label, start_date, end_date) for the last n months including current."""
    today = date.today()
    out = []
    for i in range(n - 1, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        first = date(y, m, 1)
        if m == 12:
            last = date(y + 1, 1, 1) - timedelta(days=1)
        else:
            last = date(y, m + 1, 1) - timedelta(days=1)
        out.append((first.strftime("%b %Y"), first, last))
    return out


def _months_forward(n: int):
    today = date.today()
    out = []
    for i in range(n):
        m = today.month + i
        y = today.year
        while m > 12:
            m -= 12
            y += 1
        first = date(y, m, 1)
        if m == 12:
            last = date(y + 1, 1, 1) - timedelta(days=1)
        else:
            last = date(y, m + 1, 1) - timedelta(days=1)
        out.append((first.strftime("%b %Y"), first, last))
    return out


# ── main endpoint ────────────────────────────────────────────────────────────

@router.get("/dashboard")
def cfo_dashboard(
    fee_pct: float = 10.0,
    handling_cost_per_job: float = 25.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full CFO synthesis: KPIs, scorecard, push/drop actions, forecast."""
    org_id = current_user.organisation_id
    today = date.today()
    fee_rate = max(0.0, min(fee_pct, 100.0)) / 100.0

    # ── Load portfolio ───────────────────────────────────────────────────────
    properties = db.query(Property).filter(Property.organisation_id == org_id).all()
    prop_ids = [p.id for p in properties]
    prop_by_id = {p.id: p for p in properties}

    # Per-landlord fee rates (fall back to query param default)
    landlord_ids = {p.landlord_id for p in properties if p.landlord_id}
    landlords = db.query(Landlord).filter(Landlord.id.in_(landlord_ids)).all() if landlord_ids else []
    landlord_fee: dict[int, float] = {
        ll.id: (ll.management_fee_pct / 100.0 if ll.management_fee_pct is not None else fee_rate)
        for ll in landlords
    }
    # Map property → effective fee rate
    prop_fee_rate: dict[int, float] = {
        p.id: landlord_fee.get(p.landlord_id, fee_rate) for p in properties
    }

    if not prop_ids:
        return _empty_response(fee_pct, handling_cost_per_job)

    units = db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()
    unit_ids = [u.id for u in units]
    unit_to_prop = {u.id: u.property_id for u in units}
    units_by_prop: dict[int, list[Unit]] = defaultdict(list)
    for u in units:
        units_by_prop[u.property_id].append(u)

    leases = db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all() if unit_ids else []
    active_leases = [l for l in leases if l.status == "active"]
    lease_by_unit: dict[int, Lease] = {}
    for l in active_leases:
        lease_by_unit[l.unit_id] = l

    # ── 12-month windows ─────────────────────────────────────────────────────
    window_start = (today.replace(day=1) - timedelta(days=365)).replace(day=1)

    # All payments in window
    all_payments = db.query(RentPayment).filter(
        RentPayment.lease_id.in_([l.id for l in leases]),
        RentPayment.due_date >= window_start,
    ).all() if leases else []

    # All maintenance jobs in window (closed with cost)
    all_jobs = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.unit_id.in_(unit_ids),
        MaintenanceRequest.created_at >= window_start,
    ).all() if unit_ids else []

    # ── Aggregate per-property over 12mo ─────────────────────────────────────
    rent_collected_12mo: dict[int, float] = defaultdict(float)
    rent_expected_12mo: dict[int, float] = defaultdict(float)
    maintenance_cost_12mo: dict[int, float] = defaultdict(float)
    job_count_12mo: dict[int, int] = defaultdict(int)

    lease_to_prop = {l.id: unit_to_prop.get(l.unit_id) for l in leases}

    for p in all_payments:
        pid = lease_to_prop.get(p.lease_id)
        if pid is None:
            continue
        rent_expected_12mo[pid] += p.amount_due or 0
        if p.status == "paid":
            rent_collected_12mo[pid] += p.amount_paid or 0
        elif p.status == "partial":
            rent_collected_12mo[pid] += p.amount_paid or 0

    for j in all_jobs:
        pid = unit_to_prop.get(j.unit_id)
        if pid is None:
            continue
        maintenance_cost_12mo[pid] += j.actual_cost or 0
        job_count_12mo[pid] += 1

    # ── Per-property scorecard ───────────────────────────────────────────────
    scorecard = []
    for prop in properties:
        prop_units = units_by_prop.get(prop.id, [])
        unit_count = len(prop_units)
        occupied_count = sum(1 for u in prop_units if u.status == "occupied")
        active_for_prop = [l for l in active_leases if unit_to_prop.get(l.unit_id) == prop.id]
        monthly_rent = sum(l.monthly_rent for l in active_for_prop)
        annual_rent = monthly_rent * 12

        rent_in = rent_collected_12mo.get(prop.id, 0.0)
        rent_due = rent_expected_12mo.get(prop.id, 0.0)
        maint_cost = maintenance_cost_12mo.get(prop.id, 0.0)
        jobs = job_count_12mo.get(prop.id, 0)

        # Agency economics — use per-landlord fee rate where available
        eff_rate = prop_fee_rate.get(prop.id, fee_rate)
        agency_revenue = rent_in * eff_rate
        cost_to_serve = jobs * handling_cost_per_job
        net_to_agency = agency_revenue - cost_to_serve
        margin = (net_to_agency / agency_revenue * 100) if agency_revenue > 0 else 0.0

        # Void exposure: vacant unit-months × monthly rent (lost mgmt fee)
        vacant_units = unit_count - occupied_count
        avg_unit_rent = (monthly_rent / occupied_count) if occupied_count else (
            sum(u.monthly_rent for u in prop_units) / unit_count if unit_count else 0
        )
        void_exposure_monthly_fee = vacant_units * avg_unit_rent * eff_rate

        # Collection rate
        collection_rate = (rent_in / rent_due * 100) if rent_due > 0 else 100.0

        # Score: 0..100. Higher = healthier for agency.
        # +40 margin (clamped), +30 occupancy, +20 collection, +10 low-jobs
        margin_pts = max(0, min(40, margin / 2))  # 80% margin = 40pts
        occ_pts = (occupied_count / unit_count * 30) if unit_count else 0
        coll_pts = max(0, min(20, (collection_rate - 80) / 1))  # 100% = 20, 80% = 0
        jobs_pts = 10 if jobs <= 2 else (5 if jobs <= 5 else 0)
        score = round(margin_pts + occ_pts + coll_pts + jobs_pts)

        # Verdict
        if net_to_agency < 0:
            verdict = "drop"
        elif score >= 75:
            verdict = "star"
        elif score >= 50:
            verdict = "ok"
        else:
            verdict = "watch"

        scorecard.append({
            "property_id": prop.id,
            "property_name": prop.name,
            "address": f"{prop.address_line1}, {prop.city}",
            "units": unit_count,
            "occupied": occupied_count,
            "monthly_rent": round(monthly_rent, 2),
            "annual_rent_roll": round(annual_rent, 2),
            "rent_collected_12mo": round(rent_in, 2),
            "agency_revenue_12mo": round(agency_revenue, 2),
            "maintenance_cost_12mo": round(maint_cost, 2),
            "cost_to_serve_12mo": round(cost_to_serve, 2),
            "net_to_agency_12mo": round(net_to_agency, 2),
            "margin_pct": round(margin, 1),
            "collection_rate": round(collection_rate, 1),
            "void_units": vacant_units,
            "void_monthly_fee_lost": round(void_exposure_monthly_fee, 2),
            "jobs_12mo": jobs,
            "score": score,
            "verdict": verdict,
            "fee_pct": round(eff_rate * 100, 2),
        })

    scorecard.sort(key=lambda x: -x["net_to_agency_12mo"])

    # ── Hero KPIs ────────────────────────────────────────────────────────────
    total_collected = sum(s["rent_collected_12mo"] for s in scorecard)
    total_agency_revenue = sum(s["agency_revenue_12mo"] for s in scorecard)
    total_cost_to_serve = sum(s["cost_to_serve_12mo"] for s in scorecard)
    total_net = total_agency_revenue - total_cost_to_serve
    overall_margin = (total_net / total_agency_revenue * 100) if total_agency_revenue > 0 else 0
    profitable_props = sum(1 for s in scorecard if s["net_to_agency_12mo"] > 0)
    pct_profitable = (profitable_props / len(scorecard) * 100) if scorecard else 0
    monthly_rent_roll = sum(s["monthly_rent"] for s in scorecard)
    monthly_agency_run_rate = monthly_rent_roll * fee_rate

    total_units = sum(s["units"] for s in scorecard)
    total_occupied = sum(s["occupied"] for s in scorecard)
    occupancy = (total_occupied / total_units * 100) if total_units else 0

    kpis = {
        "agency_revenue_12mo": round(total_agency_revenue, 2),
        "cost_to_serve_12mo": round(total_cost_to_serve, 2),
        "net_agency_margin_12mo": round(total_net, 2),
        "margin_pct": round(overall_margin, 1),
        "monthly_rent_roll": round(monthly_rent_roll, 2),
        "monthly_agency_run_rate": round(monthly_agency_run_rate, 2),
        "annual_agency_run_rate": round(monthly_agency_run_rate * 12, 2),
        "occupancy_pct": round(occupancy, 1),
        "properties": len(scorecard),
        "units": total_units,
        "occupied_units": total_occupied,
        "profitable_properties": profitable_props,
        "pct_profitable": round(pct_profitable, 1),
        "fee_pct": fee_pct,
        "handling_cost_per_job": handling_cost_per_job,
    }

    # ── PUSH actions ─────────────────────────────────────────────────────────
    push_actions = _build_push_actions(
        db, org_id, properties, units, active_leases, fee_rate, today
    )

    # ── DROP actions ─────────────────────────────────────────────────────────
    drop_actions = _build_drop_actions(scorecard)

    # ── 12-month forecast ────────────────────────────────────────────────────
    forecast = _build_forecast(active_leases, fee_rate, today)

    return {
        "kpis": kpis,
        "scorecard": scorecard,
        "push_actions": push_actions,
        "drop_actions": drop_actions,
        "forecast": forecast,
        "settings": {
            "fee_pct": fee_pct,
            "handling_cost_per_job": handling_cost_per_job,
        },
    }


def _empty_response(fee_pct: float, handling_cost_per_job: float):
    return {
        "kpis": {
            "agency_revenue_12mo": 0, "cost_to_serve_12mo": 0,
            "net_agency_margin_12mo": 0, "margin_pct": 0,
            "monthly_rent_roll": 0, "monthly_agency_run_rate": 0,
            "annual_agency_run_rate": 0, "occupancy_pct": 0,
            "properties": 0, "units": 0, "occupied_units": 0,
            "profitable_properties": 0, "pct_profitable": 0,
            "fee_pct": fee_pct, "handling_cost_per_job": handling_cost_per_job,
        },
        "scorecard": [],
        "push_actions": [],
        "drop_actions": [],
        "forecast": [],
        "settings": {"fee_pct": fee_pct, "handling_cost_per_job": handling_cost_per_job},
    }


def _build_push_actions(db, org_id, properties, units, active_leases, fee_rate, today):
    """Ranked list of revenue-positive actions: rent reviews, renewals, retention."""
    actions = []
    prop_by_id = {p.id: p for p in properties}
    unit_to_prop = {u.id: u.property_id for u in units}

    # 1. Rent reviews — underpriced units (using simple market proxy: bedrooms × £400 floor)
    # We piggyback off the rent_optimisation logic but inline it here without HTTP fetch.
    # Crude proxy: if a unit has been on the same rent > 18 months and
    # other units in same property have higher rent per bedroom, flag it.
    for u in units:
        if u.status != "occupied":
            continue
        lease = next((l for l in active_leases if l.unit_id == u.id), None)
        if not lease:
            continue
        months_on_rent = ((today - lease.start_date).days // 30) if lease.start_date else 0
        if months_on_rent < 12:
            continue

        # Compare against same-property peers
        peers = [p for p in units if p.property_id == u.property_id and p.id != u.id and p.bedrooms == u.bedrooms]
        peer_rents = [p.monthly_rent for p in peers if p.monthly_rent]
        if peer_rents:
            peer_median = sorted(peer_rents)[len(peer_rents) // 2]
            gap = peer_median - u.monthly_rent
            if gap > 50:  # >£50/mo below peers
                annual_uplift = gap * 12
                fee_uplift = annual_uplift * fee_rate
                prop = prop_by_id.get(u.property_id)
                actions.append({
                    "type": "rent_review",
                    "title": f"Rent review: {prop.name if prop else ''} · {u.name}",
                    "detail": f"£{u.monthly_rent:.0f}/mo vs peers £{peer_median:.0f}/mo · on rent {months_on_rent}mo",
                    "impact_annual": round(annual_uplift, 2),
                    "fee_impact_annual": round(fee_uplift, 2),
                    "link": f"/rent-optimisation",
                    "unit_id": u.id,
                    "property_id": u.property_id,
                })

    # 2. Renewals due — leases ending in next 90 days, no accepted renewal
    soon = today + timedelta(days=90)
    for lease in active_leases:
        if not lease.end_date or lease.end_date > soon or lease.end_date < today:
            continue
        latest = (
            db.query(LeaseRenewal)
            .filter(LeaseRenewal.lease_id == lease.id)
            .order_by(LeaseRenewal.sent_at.desc())
            .first()
        )
        if latest and latest.status == "accepted":
            continue
        days_left = (lease.end_date - today).days
        unit = next((u for u in units if u.id == lease.unit_id), None)
        prop = prop_by_id.get(unit_to_prop.get(lease.unit_id))
        annual_value = lease.monthly_rent * 12
        fee_value = annual_value * fee_rate
        actions.append({
            "type": "renewal",
            "title": f"Renewal due: {prop.name if prop else ''} · {unit.name if unit else ''}",
            "detail": f"Lease ends in {days_left}d · £{lease.monthly_rent:.0f}/mo at risk",
            "impact_annual": round(annual_value, 2),
            "fee_impact_annual": round(fee_value, 2),
            "link": "/renewals",
            "unit_id": unit.id if unit else None,
            "property_id": unit_to_prop.get(lease.unit_id),
        })

    # 3. Retention saves — high-churn-risk tenants worth keeping
    # Quick churn heuristic: lease with overdue payments + ending within 6 months
    six_mo = today + timedelta(days=180)
    for lease in active_leases:
        if not lease.end_date or lease.end_date > six_mo or lease.end_date < today:
            continue
        overdue_count = db.query(RentPayment).filter(
            RentPayment.lease_id == lease.id,
            RentPayment.status == "overdue",
            RentPayment.due_date >= today - timedelta(days=180),
        ).count()
        if overdue_count == 0:
            continue
        annual_value = lease.monthly_rent * 12
        fee_value = annual_value * fee_rate
        unit = next((u for u in units if u.id == lease.unit_id), None)
        prop = prop_by_id.get(unit_to_prop.get(lease.unit_id))
        actions.append({
            "type": "retention",
            "title": f"Retention save: {prop.name if prop else ''} · {unit.name if unit else ''}",
            "detail": f"{overdue_count} late payment(s) · lease ends {lease.end_date.isoformat()}",
            "impact_annual": round(annual_value, 2),
            "fee_impact_annual": round(fee_value, 2),
            "link": "/churn-risk",
            "unit_id": unit.id if unit else None,
            "property_id": unit_to_prop.get(lease.unit_id),
        })

    actions.sort(key=lambda a: -a["fee_impact_annual"])
    return actions[:20]


def _build_drop_actions(scorecard):
    """Ranked list of properties dragging on agency margin."""
    drops = []
    for s in scorecard:
        # Stars never appear here — they earn their score and shouldn't be flagged to drop.
        # OK properties only appear if they have a genuine financial problem (negative net
        # or extreme job count), not just a collection quirk.
        if s["verdict"] == "star":
            continue
        if s["verdict"] == "ok" and s["net_to_agency_12mo"] >= 0 and s["jobs_12mo"] < 10:
            continue

        reasons = []
        if s["net_to_agency_12mo"] < 0:
            reasons.append(f"net loss to agency £{abs(s['net_to_agency_12mo']):.0f}/yr")
        if s["jobs_12mo"] >= 6:
            reasons.append(f"{s['jobs_12mo']} maintenance jobs in 12mo")
        if s["collection_rate"] < 90 and s["rent_collected_12mo"] > 0:
            reasons.append(f"only {s['collection_rate']:.0f}% rent collected")
        if s["void_units"] > 0:
            reasons.append(f"{s['void_units']} unit(s) vacant")
        if s["margin_pct"] < 30 and s["agency_revenue_12mo"] > 0:
            reasons.append(f"thin {s['margin_pct']:.0f}% margin")

        if not reasons:
            continue

        # Drag = lost potential (negative margin or below-portfolio average)
        drag = max(0, -s["net_to_agency_12mo"]) + s["void_monthly_fee_lost"] * 12
        drops.append({
            "property_id": s["property_id"],
            "property_name": s["property_name"],
            "score": s["score"],
            "verdict": s["verdict"],
            "net_to_agency_12mo": s["net_to_agency_12mo"],
            "drag_estimate": round(drag, 2),
            "reasons": reasons,
            "link": f"/properties/{s['property_id']}",
        })
    drops.sort(key=lambda d: -d["drag_estimate"])
    return drops[:10]


def _build_forecast(active_leases, fee_rate, today):
    """12-month forward agency revenue forecast based on active leases."""
    forecast = []
    for label, start, end in _months_forward(12):
        # For each active lease, count it if it's still active in this period
        gross_rent = 0.0
        at_risk_rent = 0.0
        for lease in active_leases:
            if lease.start_date and lease.start_date > end:
                continue
            ends = lease.end_date
            if ends and ends < start:
                continue
            gross_rent += lease.monthly_rent
            # Rent at risk: lease ends within this month
            if ends and start <= ends <= end:
                at_risk_rent += lease.monthly_rent
        forecast.append({
            "month": label,
            "gross_rent": round(gross_rent, 2),
            "agency_revenue": round(gross_rent * fee_rate, 2),
            "at_risk_rent": round(at_risk_rent, 2),
            "at_risk_fee": round(at_risk_rent * fee_rate, 2),
        })
    return forecast


# ── Rent review letter ────────────────────────────────────────────────────────

class RentReviewLetterRequest(BaseModel):
    unit_id: int
    proposed_rent: float
    effective_date: str            # ISO date e.g. "2026-06-01"
    custom_notes: Optional[str] = None
    send_email: bool = False       # also email to landlord


@router.post("/rent-review-letter")
def create_rent_review_letter(
    req: RentReviewLetterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate (and optionally email) a rent review recommendation PDF to the landlord."""
    org_id = current_user.organisation_id

    unit = db.query(Unit).filter(Unit.id == req.unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    prop = db.query(Property).filter(
        Property.id == unit.property_id,
        Property.organisation_id == org_id,
    ).first()
    if not prop:
        raise HTTPException(status_code=403, detail="Not your property")

    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    landlord = db.query(Landlord).filter(Landlord.id == prop.landlord_id).first() if prop.landlord_id else None

    # Peer comparables
    peers_raw = db.query(Unit).filter(
        Unit.property_id == prop.id,
        Unit.id != unit.id,
        Unit.bedrooms == unit.bedrooms,
    ).all()
    peer_rents = sorted([p.monthly_rent for p in peers_raw if p.monthly_rent])
    peer_median = peer_rents[len(peer_rents) // 2] if peer_rents else req.proposed_rent

    # Months on current rent
    active_lease = db.query(Lease).filter(
        Lease.unit_id == unit.id,
        Lease.status == "active",
    ).first()
    today = date.today()
    months_on = ((today - active_lease.start_date).days // 30) if active_lease and active_lease.start_date else 0

    annual_uplift = round((req.proposed_rent - unit.monthly_rent) * 12, 2)

    # Effective date display
    try:
        eff = date.fromisoformat(req.effective_date)
        eff_display = eff.strftime("%-d %B %Y")
    except Exception:
        eff_display = req.effective_date

    ctx = {
        "org_name": org.name if org else "PropAIrty",
        "today": today.strftime("%-d %B %Y"),
        "landlord_name": landlord.full_name if landlord else "Landlord",
        "property_address": f"{prop.address_line1}, {prop.city}",
        "unit_name": unit.name,
        "bedrooms": unit.bedrooms or 1,
        "current_rent": f"{unit.monthly_rent:,.0f}",
        "proposed_rent": f"{req.proposed_rent:,.0f}",
        "peer_median": f"{peer_median:,.0f}",
        "annual_uplift": f"{annual_uplift:,.0f}",
        "months_on_rent": months_on,
        "effective_date": eff_display,
        "peers": [{"name": p.name, "bedrooms": p.bedrooms or 1, "rent": f"{p.monthly_rent:,.0f}"} for p in peers_raw],
        "custom_notes": req.custom_notes or "",
        "signature_block": "",
    }

    from jinja2 import Environment, FileSystemLoader
    from pathlib import Path
    import weasyprint
    template_dir = Path(__file__).parent.parent / "templates"
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template("documents/rent_review_recommendation.html")
    html_str = template.render(**ctx)
    pdf_bytes = weasyprint.HTML(string=html_str).write_pdf()

    # Optionally email landlord
    email_status = None
    if req.send_email and landlord and landlord.email:
        try:
            _emails.send_email(
                to=landlord.email,
                subject=f"Rent Review Recommendation — {unit.name}, {prop.address_line1}",
                body=f"""Dear {landlord.full_name},

Please find attached our rent review recommendation for {unit.name} at {prop.address_line1}.

We recommend increasing the rent from £{unit.monthly_rent:.0f}/mo to £{req.proposed_rent:.0f}/mo, effective {eff_display}.

This represents an annual income uplift of £{annual_uplift:,.0f}.

Please review the attached document and confirm your approval so we can proceed with serving notice to the tenant.

Kind regards,
{org.name if org else 'Your letting agent'}""",
                attachments=[("RentReview.pdf", pdf_bytes, "application/pdf")],
            )
            email_status = "sent"
        except Exception as e:
            email_status = f"failed: {e}"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="RentReview-{unit.name.replace(" ", "_")}.pdf"',
            "X-Email-Status": email_status or "not-sent",
        },
    )
