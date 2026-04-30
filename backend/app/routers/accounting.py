import csv
import io
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from weasyprint import HTML

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.payment import RentPayment
from app.models.lease import Lease
from app.models.maintenance import MaintenanceRequest
from app.models.unit import Unit
from app.models.property import Property
from app.models.tenant import Tenant
from app.models.contractor import Contractor
from app.models.organisation import Organisation
from app.models.landlord import Landlord

import os

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")


def _build_report_data(
    org_id: int,
    from_date: date,
    to_date: date,
    property_id: Optional[int],
    db: Session,
    landlord_id: Optional[int] = None,
):
    org = db.query(Organisation).filter(Organisation.id == org_id).first()

    # All properties for this org (or filtered)
    prop_query = db.query(Property).filter(Property.organisation_id == org_id)
    if landlord_id:
        prop_query = prop_query.filter(Property.landlord_id == landlord_id)
    if property_id:
        prop_query = prop_query.filter(Property.id == property_id)
    properties = prop_query.all()

    total_income = 0.0
    total_expenditure = 0.0
    income_count = 0
    expenditure_count = 0
    prop_data = []

    for prop in properties:
        income_rows = []
        expenditure_rows = []

        # Build a fast unit lookup for this property
        unit_lookup = {u.id: u for u in prop.units}

        # --- Income: paid rent payments in date range ---
        unit_ids = list(unit_lookup.keys())
        if unit_ids:
            payments = (
                db.query(RentPayment)
                .join(Lease, RentPayment.lease_id == Lease.id)
                .filter(
                    Lease.unit_id.in_(unit_ids),
                    RentPayment.status == "paid",
                    RentPayment.paid_date >= from_date,
                    RentPayment.paid_date <= to_date,
                )
                .order_by(RentPayment.paid_date)
                .all()
            )
            for p in payments:
                lease = p.lease
                tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
                unit = unit_lookup.get(lease.unit_id) if lease else None
                income_rows.append({
                    "paid_date": p.paid_date.isoformat() if p.paid_date else None,
                    "tenant_name": tenant.full_name if tenant else "Unknown",
                    "unit_name": unit.name if unit else "—",
                    "period": p.due_date.strftime("%b %Y") if p.due_date else "—",
                    "amount": p.amount_paid or 0,
                })

            # --- Expenditure: maintenance jobs with actual_cost in date range ---
            jobs = (
                db.query(MaintenanceRequest)
                .filter(
                    MaintenanceRequest.unit_id.in_(unit_ids),
                    MaintenanceRequest.actual_cost.isnot(None),
                    MaintenanceRequest.actual_cost > 0,
                    MaintenanceRequest.created_at >= datetime.combine(from_date, datetime.min.time()),
                    MaintenanceRequest.created_at <= datetime.combine(to_date, datetime.max.time()),
                )
                .order_by(MaintenanceRequest.created_at)
                .all()
            )
            for j in jobs:
                contractor = db.query(Contractor).filter(Contractor.id == j.contractor_id).first() if j.contractor_id else None
                contractor_name = contractor.full_name if contractor else (j.assigned_to or None)
                unit = unit_lookup.get(j.unit_id)
                expenditure_rows.append({
                    "date": j.created_at.date().isoformat() if j.created_at else None,
                    "title": j.title,
                    "contractor": contractor_name,
                    "invoice_ref": j.invoice_ref,
                    "unit_name": unit.name if unit else "—",
                    "amount": j.actual_cost,
                })

        prop_income = sum(r["amount"] for r in income_rows)
        prop_expenditure = sum(r["amount"] for r in expenditure_rows)

        total_income += prop_income
        total_expenditure += prop_expenditure
        income_count += len(income_rows)
        expenditure_count += len(expenditure_rows)

        # Group by unit for the summary breakdown
        from collections import defaultdict
        unit_map: dict = defaultdict(lambda: {"income": 0.0, "expenditure": 0.0, "income_count": 0, "expenditure_count": 0})
        for r in income_rows:
            unit_map[r["unit_name"]]["income"] += r["amount"]
            unit_map[r["unit_name"]]["income_count"] += 1
        for r in expenditure_rows:
            unit_map[r["unit_name"]]["expenditure"] += r["amount"]
            unit_map[r["unit_name"]]["expenditure_count"] += 1
        units_summary = [
            {
                "unit_name": k,
                "income": v["income"],
                "expenditure": v["expenditure"],
                "net": v["income"] - v["expenditure"],
                "income_count": v["income_count"],
                "expenditure_count": v["expenditure_count"],
            }
            for k, v in sorted(unit_map.items())
        ]

        prop_data.append({
            "name": prop.name,
            "address": f"{prop.address_line1}, {prop.city} {prop.postcode}",
            "income_rows": income_rows,
            "expenditure_rows": expenditure_rows,
            "total_income": prop_income,
            "total_expenditure": prop_expenditure,
            "net": prop_income - prop_expenditure,
            "units": units_summary,
        })

    return {
        "org_name": org.name if org else "Your Organisation",
        "from_date": from_date.strftime("%d/%m/%Y"),
        "to_date": to_date.strftime("%d/%m/%Y"),
        "generated_date": date.today().strftime("%d/%m/%Y"),
        "property_filter": prop_data[0]["name"] if property_id and prop_data else None,
        "properties": prop_data,
        "total_income": total_income,
        "total_expenditure": total_expenditure,
        "net_profit": total_income - total_expenditure,
        "income_count": income_count,
        "expenditure_count": expenditure_count,
    }


@router.get("/report")
def get_report(
    from_date: date = Query(...),
    to_date: date = Query(...),
    property_id: Optional[int] = Query(None),
    landlord_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _build_report_data(current_user.organisation_id, from_date, to_date, property_id, db, landlord_id)


@router.get("/export/pdf")
def export_pdf(
    from_date: date = Query(...),
    to_date: date = Query(...),
    property_id: Optional[int] = Query(None),
    landlord_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = _build_report_data(current_user.organisation_id, from_date, to_date, property_id, db, landlord_id)
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("documents/income_expenditure.html")
    html_content = template.render(**data)
    pdf_bytes = HTML(string=html_content).write_pdf()
    filename = f"income_expenditure_{from_date}_{to_date}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/csv")
def export_csv(
    from_date: date = Query(...),
    to_date: date = Query(...),
    property_id: Optional[int] = Query(None),
    landlord_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = _build_report_data(current_user.organisation_id, from_date, to_date, property_id, db, landlord_id)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Income & Expenditure Statement"])
    writer.writerow([f"Organisation: {data['org_name']}"])
    writer.writerow([f"Period: {data['from_date']} to {data['to_date']}"])
    writer.writerow([f"Generated: {data['generated_date']}"])
    writer.writerow([])

    # Income section
    writer.writerow(["INCOME — RENT RECEIVED"])
    writer.writerow(["Property", "Unit", "Tenant", "Period", "Date Paid", "Amount (£)"])
    for prop in data["properties"]:
        for r in prop["income_rows"]:
            writer.writerow([prop["name"], r["unit_name"], r["tenant_name"], r["period"], r["paid_date"], f"{r['amount']:.2f}"])
    writer.writerow(["", "", "", "", "Total Income", f"{data['total_income']:.2f}"])
    writer.writerow([])

    # Expenditure section
    writer.writerow(["EXPENDITURE — MAINTENANCE & REPAIRS"])
    writer.writerow(["Property", "Date", "Description", "Contractor", "Invoice Ref", "Amount (£)"])
    for prop in data["properties"]:
        for r in prop["expenditure_rows"]:
            writer.writerow([prop["name"], r["date"], r["title"], r["contractor"] or "", r["invoice_ref"] or "", f"{r['amount']:.2f}"])
    writer.writerow(["", "", "", "", "Total Expenditure", f"{data['total_expenditure']:.2f}"])
    writer.writerow([])

    # Summary
    writer.writerow(["SUMMARY"])
    writer.writerow(["", "", "", "", "Net Profit", f"{data['net_profit']:.2f}"])
    writer.writerow([])

    # Per-property totals (with unit breakdown for multi-unit properties)
    writer.writerow(["PER-PROPERTY SUMMARY"])
    writer.writerow(["Property / Unit", "Income (£)", "Expenditure (£)", "Net (£)"])
    for prop in data["properties"]:
        writer.writerow([prop["name"], f"{prop['total_income']:.2f}", f"{prop['total_expenditure']:.2f}", f"{prop['net']:.2f}"])
        if len(prop.get("units", [])) > 1:
            for u in prop["units"]:
                writer.writerow([f"  └ {u['unit_name']}", f"{u['income']:.2f}", f"{u['expenditure']:.2f}", f"{u['net']:.2f}"])

    csv_content = output.getvalue()
    filename = f"income_expenditure_{from_date}_{to_date}.csv"
    return StreamingResponse(
        io.BytesIO(csv_content.encode("utf-8-sig")),  # utf-8-sig for Excel compatibility
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/landlords")
def list_landlords(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    landlords = (
        db.query(Landlord)
        .filter(Landlord.organisation_id == current_user.organisation_id)
        .all()
    )
    landlords.sort(key=lambda l: (l.full_name or '').split()[-1].lower() if l.full_name else '')
    return [{"id": l.id, "full_name": l.full_name} for l in landlords]


@router.get("/properties")
def list_properties(
    landlord_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Property).filter(Property.organisation_id == current_user.organisation_id)
    if landlord_id:
        q = q.filter(Property.landlord_id == landlord_id)
    return [{"id": p.id, "name": p.name} for p in q.order_by(Property.name).all()]
