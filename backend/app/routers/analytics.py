"""
Portfolio analytics endpoints.
All data is computed from existing DB records — no new data storage.
"""
from datetime import date, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.property import Property
from app.models.unit import Unit
from app.models.lease import Lease
from app.models.payment import RentPayment
from app.models.maintenance import MaintenanceRequest
from app.models.compliance import ComplianceCertificate, CERT_TYPES

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _months_back(n: int) -> list[tuple[str, date, date]]:
    """Return list of (label, start, end) for last n months including current."""
    result = []
    today = date.today()
    for i in range(n - 1, -1, -1):
        first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        # Better approach: subtract months properly
        month = today.month - i
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        first = date(year, month, 1)
        # Last day of month
        if month == 12:
            last = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last = date(year, month + 1, 1) - timedelta(days=1)
        label = first.strftime("%b %Y")
        result.append((label, first, last))
    return result


@router.get("/overview")
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """High-level portfolio metrics."""
    org_id = current_user.organisation_id

    properties = db.query(Property).filter(Property.organisation_id == org_id).all()
    prop_ids = [p.id for p in properties]

    units = db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all() if prop_ids else []
    unit_ids = [u.id for u in units]

    occupied = [u for u in units if u.status == "occupied"]
    vacant = [u for u in units if u.status == "vacant"]

    active_leases = db.query(Lease).filter(
        Lease.unit_id.in_(unit_ids), Lease.status == "active"
    ).all() if unit_ids else []

    monthly_rent_roll = sum(l.monthly_rent for l in active_leases)

    # This month's payments
    today = date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)

    this_month_payments = db.query(RentPayment).filter(
        RentPayment.lease_id.in_([l.id for l in active_leases]),
        RentPayment.due_date >= month_start,
        RentPayment.due_date <= month_end,
    ).all() if active_leases else []

    collected = sum(p.amount_paid or 0 for p in this_month_payments if p.status == "paid")
    expected = sum(p.amount_due for p in this_month_payments)
    arrears = sum(
        p.amount_due - (p.amount_paid or 0)
        for p in this_month_payments
        if p.status in ("overdue", "partial")
    )

    open_maintenance = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.unit_id.in_(unit_ids),
        MaintenanceRequest.status.in_(["open", "in_progress"])
    ).count() if unit_ids else 0

    # Compliance
    expired_certs = db.query(ComplianceCertificate).filter(
        ComplianceCertificate.property_id.in_(prop_ids),
        ComplianceCertificate.expiry_date < today
    ).count() if prop_ids else 0

    return {
        "properties": len(properties),
        "units": len(units),
        "occupied": len(occupied),
        "vacant": len(vacant),
        "occupancy_rate": round(len(occupied) / len(units) * 100) if units else 0,
        "active_leases": len(active_leases),
        "monthly_rent_roll": monthly_rent_roll,
        "annual_rent_roll": monthly_rent_roll * 12,
        "this_month_expected": expected,
        "this_month_collected": collected,
        "this_month_arrears": arrears,
        "collection_rate": round(collected / expected * 100) if expected else 0,
        "open_maintenance": open_maintenance,
        "expired_certs": expired_certs,
    }


@router.get("/rent-collection")
def rent_collection(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Monthly rent collected vs expected for last N months."""
    org_id = current_user.organisation_id
    prop_ids = [p.id for p in db.query(Property).filter(Property.organisation_id == org_id).all()]
    if not prop_ids:
        return []

    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    lease_ids = [l.id for l in db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all()] if unit_ids else []

    result = []
    for label, start, end in _months_back(months):
        payments = db.query(RentPayment).filter(
            RentPayment.lease_id.in_(lease_ids),
            RentPayment.due_date >= start,
            RentPayment.due_date <= end,
        ).all() if lease_ids else []

        expected = sum(p.amount_due for p in payments)
        collected = sum(p.amount_paid or 0 for p in payments if p.status == "paid")
        arrears = sum(
            p.amount_due - (p.amount_paid or 0)
            for p in payments if p.status in ("overdue", "partial")
        )
        result.append({
            "month": label,
            "expected": round(expected, 2),
            "collected": round(collected, 2),
            "arrears": round(arrears, 2),
            "collection_rate": round(collected / expected * 100) if expected else 0,
        })
    return result


@router.get("/occupancy")
def occupancy_trend(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Occupancy snapshot per month (based on active leases per period)."""
    org_id = current_user.organisation_id
    prop_ids = [p.id for p in db.query(Property).filter(Property.organisation_id == org_id).all()]
    if not prop_ids:
        return []

    units = db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()
    total_units = len(units)
    if not total_units:
        return []

    unit_ids = [u.id for u in units]
    leases = db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all()

    result = []
    for label, start, end in _months_back(months):
        # Count leases that were active during this month
        active = sum(
            1 for l in leases
            if l.start_date <= end and (l.end_date is None or l.end_date >= start)
            and l.status in ("active", "expired")
        )
        occupied = min(active, total_units)
        result.append({
            "month": label,
            "occupied": occupied,
            "vacant": total_units - occupied,
            "total": total_units,
            "rate": round(occupied / total_units * 100),
        })
    return result


@router.get("/maintenance-costs")
def maintenance_costs(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Maintenance cost breakdown by month and by property."""
    org_id = current_user.organisation_id
    prop_ids = [p.id for p in db.query(Property).filter(Property.organisation_id == org_id).all()]
    prop_names = {p.id: p.name for p in db.query(Property).filter(Property.organisation_id == org_id).all()}
    if not prop_ids:
        return {"by_month": [], "by_property": [], "by_trade": []}

    unit_ids = [u.id for u in db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()]
    jobs = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.unit_id.in_(unit_ids),
        MaintenanceRequest.actual_cost.isnot(None),
    ).all() if unit_ids else []

    # By month (using created_at)
    month_costs = defaultdict(float)
    for label, start, end in _months_back(months):
        month_costs[label] = 0.0

    for j in jobs:
        if j.created_at:
            label = j.created_at.strftime("%b %Y")
            if label in month_costs:
                month_costs[label] += j.actual_cost or 0

    by_month = [{"month": m, "cost": round(month_costs[m], 2)} for m, _, _ in _months_back(months)]

    # By property
    prop_costs = defaultdict(float)
    for j in jobs:
        if j.unit and j.unit.property_id:
            prop_costs[j.unit.property_id] += j.actual_cost or 0
    by_property = [
        {"property": prop_names.get(pid, "Unknown"), "cost": round(cost, 2)}
        for pid, cost in sorted(prop_costs.items(), key=lambda x: -x[1])
    ]

    # By contractor trade
    trade_costs = defaultdict(float)
    for j in jobs:
        trade = j.contractor.trade if j.contractor else "Unassigned"
        trade_costs[trade or "Unassigned"] += j.actual_cost or 0
    by_trade = [
        {"trade": t, "cost": round(c, 2)}
        for t, c in sorted(trade_costs.items(), key=lambda x: -x[1])
    ]

    return {"by_month": by_month, "by_property": by_property, "by_trade": by_trade}


@router.get("/yield")
def portfolio_yield(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Yield and financial summary per property."""
    org_id = current_user.organisation_id
    properties = db.query(Property).filter(Property.organisation_id == org_id).all()

    result = []
    for prop in properties:
        units = db.query(Unit).filter(Unit.property_id == prop.id).all()
        unit_ids = [u.id for u in units]

        active_leases = db.query(Lease).filter(
            Lease.unit_id.in_(unit_ids), Lease.status == "active"
        ).all() if unit_ids else []

        annual_rent = sum(l.monthly_rent for l in active_leases) * 12
        occupied = len([u for u in units if u.status == "occupied"])

        # Maintenance costs (total)
        jobs = db.query(MaintenanceRequest).filter(
            MaintenanceRequest.unit_id.in_(unit_ids),
            MaintenanceRequest.actual_cost.isnot(None),
        ).all() if unit_ids else []
        total_maintenance = sum(j.actual_cost or 0 for j in jobs)

        # Expiring leases
        today = date.today()
        expiring_90 = len([
            l for l in active_leases
            if l.end_date and (l.end_date - today).days <= 90
        ])

        result.append({
            "property_id": prop.id,
            "property": prop.name,
            "address": f"{prop.address_line1}, {prop.city}",
            "units": len(units),
            "occupied": occupied,
            "occupancy_rate": round(occupied / len(units) * 100) if units else 0,
            "monthly_rent_roll": sum(l.monthly_rent for l in active_leases),
            "annual_rent": round(annual_rent, 2),
            "total_maintenance_cost": round(total_maintenance, 2),
            "net_annual": round(annual_rent - total_maintenance, 2),
            "expiring_leases_90d": expiring_90,
        })

    result.sort(key=lambda x: -x["annual_rent"])
    return result


@router.get("/pnl")
def profit_and_loss(
    months: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Monthly P&L: income (rent collected) vs expenses (maintenance costs).
    Returns per-month breakdown + totals + per-property summary.
    """
    org_id = current_user.organisation_id
    properties = db.query(Property).filter(Property.organisation_id == org_id).all()
    prop_ids = [p.id for p in properties]
    prop_names = {p.id: p.name for p in properties}

    if not prop_ids:
        return {"by_month": [], "by_property": [], "totals": {}}

    units = db.query(Unit).filter(Unit.property_id.in_(prop_ids)).all()
    unit_ids = [u.id for u in units]
    unit_to_prop = {u.id: u.property_id for u in units}

    leases = db.query(Lease).filter(Lease.unit_id.in_(unit_ids)).all() if unit_ids else []
    lease_ids = [l.id for l in leases]

    maintenance_jobs = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.unit_id.in_(unit_ids),
        MaintenanceRequest.actual_cost.isnot(None),
    ).all() if unit_ids else []

    periods = _months_back(months)

    # ── Per-month P&L ──────────────────────────────────────────────────────────
    by_month = []
    total_income = total_expenses = 0.0

    for label, start, end in periods:
        # Income: rent payments collected in this period
        payments = db.query(RentPayment).filter(
            RentPayment.lease_id.in_(lease_ids),
            RentPayment.due_date >= start,
            RentPayment.due_date <= end,
        ).all() if lease_ids else []

        income = sum(p.amount_paid or 0 for p in payments if p.status == "paid")
        partial = sum(p.amount_paid or 0 for p in payments if p.status == "partial")
        income += partial

        # Expenses: maintenance actual costs (by job created_at)
        expenses = sum(
            j.actual_cost or 0
            for j in maintenance_jobs
            if j.created_at and start <= j.created_at.date() <= end
        )

        net = income - expenses
        total_income += income
        total_expenses += expenses

        by_month.append({
            "month": label,
            "income": round(income, 2),
            "expenses": round(expenses, 2),
            "net": round(net, 2),
            "margin": round((net / income * 100) if income > 0 else 0, 1),
        })

    # ── Per-property P&L ───────────────────────────────────────────────────────
    prop_income: dict[int, float] = defaultdict(float)
    prop_expenses: dict[int, float] = defaultdict(float)

    # Allocate rent income to property via unit
    for lease in leases:
        prop_id = unit_to_prop.get(lease.unit_id)
        if not prop_id:
            continue
        payments = db.query(RentPayment).filter(
            RentPayment.lease_id == lease.id,
            RentPayment.due_date >= periods[0][1],  # start of window
        ).all()
        for p in payments:
            if p.status in ("paid", "partial"):
                prop_income[prop_id] += p.amount_paid or 0

    # Allocate maintenance costs to property
    for j in maintenance_jobs:
        prop_id = unit_to_prop.get(j.unit_id)
        if prop_id:
            prop_expenses[prop_id] += j.actual_cost or 0

    all_prop_ids = set(list(prop_income.keys()) + list(prop_expenses.keys()))
    by_property = []
    for pid in all_prop_ids:
        inc = prop_income[pid]
        exp = prop_expenses[pid]
        net = inc - exp
        by_property.append({
            "property": prop_names.get(pid, "Unknown"),
            "income": round(inc, 2),
            "expenses": round(exp, 2),
            "net": round(net, 2),
            "margin": round((net / inc * 100) if inc > 0 else 0, 1),
        })
    by_property.sort(key=lambda x: -x["net"])

    total_net = total_income - total_expenses
    return {
        "by_month": by_month,
        "by_property": by_property,
        "totals": {
            "income": round(total_income, 2),
            "expenses": round(total_expenses, 2),
            "net": round(total_net, 2),
            "margin": round((total_net / total_income * 100) if total_income > 0 else 0, 1),
            "months": months,
        },
    }


@router.get("/agent-performance")
def agent_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-agent pipeline performance metrics."""
    from app.models.applicant import Applicant
    from datetime import date, timedelta
    from collections import defaultdict

    applicants = db.query(Applicant).filter(
        Applicant.organisation_id == current_user.organisation_id,
    ).all()

    # Group by assigned_agent (use "Unassigned" for blanks)
    agents = defaultdict(lambda: {
        "agent": "",
        "total": 0,
        "enquiries": 0,
        "viewings": 0,
        "referencing": 0,
        "converted": 0,
        "rejected": 0,
        "active": 0,
    })

    for a in applicants:
        key = a.assigned_agent or "Unassigned"
        d = agents[key]
        d["agent"] = key
        d["total"] += 1
        if a.status == "enquiry":
            d["enquiries"] += 1
        elif a.status in ("viewing_booked", "viewed"):
            d["viewings"] += 1
        elif a.status == "referencing":
            d["referencing"] += 1
        elif a.status == "tenancy_created":
            d["converted"] += 1
        elif a.status in ("rejected", "withdrawn"):
            d["rejected"] += 1

        if a.status not in ("rejected", "withdrawn", "tenancy_created"):
            d["active"] += 1

    result = sorted(agents.values(), key=lambda x: -x["converted"])

    # Add conversion rate
    for r in result:
        r["conversion_rate"] = round(r["converted"] / r["total"] * 100, 1) if r["total"] else 0

    # Follow-ups due today
    today = date.today()
    follow_ups_due = db.query(Applicant).filter(
        Applicant.organisation_id == current_user.organisation_id,
        Applicant.follow_up_date <= today,
        Applicant.follow_up_date != None,
        ~Applicant.status.in_(["rejected", "withdrawn", "tenancy_created"]),
    ).count()

    return {
        "agents": result,
        "follow_ups_due": follow_ups_due,
        "total_applicants": len(applicants),
        "total_converted": sum(1 for a in applicants if a.status == "tenancy_created"),
    }
