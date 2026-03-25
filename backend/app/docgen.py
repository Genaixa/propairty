"""
PDF document generation for PropAIrty.
Uses Jinja2 for templating and WeasyPrint for PDF rendering.
"""
import os
from datetime import date, timedelta
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
import weasyprint

TEMPLATE_DIR = Path(__file__).parent / "templates"
jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def _ordinal(n: int) -> str:
    if 11 <= (n % 100) <= 13:
        return f"{n}th"
    return f"{n}{['th','st','nd','rd','th'][min(n % 10, 4)]}"


def _render_pdf(template_name: str, context: dict) -> bytes:
    template = jinja_env.get_template(template_name)
    html_str = template.render(**context)
    return weasyprint.HTML(string=html_str).write_pdf()


def _base_context(org_name: str, ref: str = "") -> dict:
    return {
        "org_name": org_name,
        "today": date.today().strftime("%-d %B %Y"),
        "ref": ref,
    }


def generate_ast(lease, tenant, unit, org) -> bytes:
    ctx = _base_context(org.name, ref=f"AST-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "tenant_email": tenant.email or "",
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "landlord_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "start_date": lease.start_date.strftime("%-d %B %Y"),
        "end_date": lease.end_date.strftime("%-d %B %Y") if lease.end_date else "Periodic (no fixed end date)",
        "monthly_rent": f"{lease.monthly_rent:,.2f}",
        "rent_day": lease.rent_day,
        "deposit": f"{lease.deposit:,.2f}" if lease.deposit else "0.00",
        "is_periodic": lease.is_periodic,
    })
    return _render_pdf("documents/ast_agreement.html", ctx)


def generate_section21(lease, tenant, unit, org, notice_months: int = 2) -> bytes:
    today = date.today()
    possession_date = today + timedelta(days=notice_months * 30)
    ctx = _base_context(org.name, ref=f"S21-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "start_date": lease.start_date.strftime("%-d %B %Y"),
        "possession_date": possession_date.strftime("%-d %B %Y"),
    })
    return _render_pdf("documents/section_21.html", ctx)


def generate_section8(lease, tenant, unit, org, arrears_amount: float, custom_notes: str = "") -> bytes:
    today = date.today()
    court_date = today + timedelta(days=14)
    ctx = _base_context(org.name, ref=f"S8-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "arrears_amount": f"{arrears_amount:,.2f}",
        "court_date": court_date.strftime("%-d %B %Y"),
        "custom_notes": custom_notes,
    })
    return _render_pdf("documents/section_8.html", ctx)


def generate_rent_increase(lease, tenant, unit, org, new_rent: float, effective_date: date, custom_notes: str = "") -> bytes:
    current = lease.monthly_rent
    increase = new_rent - current
    pct = round((increase / current) * 100, 1)
    ctx = _base_context(org.name, ref=f"RI-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "current_rent": f"{current:,.2f}",
        "new_rent": f"{new_rent:,.2f}",
        "increase_amount": f"{increase:,.2f}",
        "increase_pct": pct,
        "effective_date": effective_date.strftime("%-d %B %Y"),
        "custom_notes": custom_notes,
    })
    return _render_pdf("documents/rent_increase.html", ctx)


def generate_financial_report(landlord, properties_data: list, compliance_items: list, renewals: list, report_month: str, org_name: str) -> bytes:
    total_collected = sum(u["collected"] for p in properties_data for u in p["units"])
    total_expected = sum(u["expected"] for p in properties_data for u in p["units"])
    total_arrears = sum(
        u["expected"] - u["collected"]
        for p in properties_data for u in p["units"]
        if u["status"] == "overdue"
    )
    ctx = {
        "org_name": org_name,
        "today": date.today().strftime("%-d %B %Y"),
        "ref": "",
        "report_month": report_month,
        "landlord_name": landlord.full_name,
        "properties": properties_data,
        "compliance_items": compliance_items,
        "renewals": renewals,
        "total_collected": total_collected,
        "total_expected": total_expected,
        "total_arrears": total_arrears,
    }
    return _render_pdf("documents/financial_report.html", ctx)


def generate_renewal_offer(renewal, org) -> bytes:
    lease = renewal.lease
    tenant = lease.tenant if lease else None
    unit = lease.unit if lease else None
    prop = unit.property if unit else None
    current_rent = lease.monthly_rent if lease else 0
    rent_change = renewal.proposed_rent - current_rent
    ctx = _base_context(org.name if org else "PropAIrty", ref=f"REN-{renewal.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name if tenant else "Tenant",
        "property_address": (
            f"{prop.address_line1}, {prop.city}, {prop.postcode}" if prop else ""
        ),
        "unit_name": unit.name if unit else "",
        "property_name": prop.name if prop else "",
        "current_rent": f"{current_rent:,.2f}",
        "proposed_rent": f"{renewal.proposed_rent:,.2f}",
        "rent_change": rent_change,
        "rent_change_str": (
            f"+£{rent_change:,.2f}" if rent_change > 0
            else (f"-£{abs(rent_change):,.2f}" if rent_change < 0 else "No change")
        ),
        "proposed_start": renewal.proposed_start.strftime("%-d %B %Y"),
        "proposed_end": renewal.proposed_end.strftime("%-d %B %Y") if renewal.proposed_end else "Periodic (rolling)",
        "is_periodic": renewal.is_periodic == "periodic",
        "agent_notes": renewal.agent_notes or "",
        "current_end": lease.end_date.strftime("%-d %B %Y") if lease and lease.end_date else "—",
    })
    return _render_pdf("documents/renewal_offer.html", ctx)


def generate_inspection_report(inspection, org, tenant=None) -> bytes:
    unit = inspection.unit
    prop = unit.property if unit else None
    ctx = _base_context(org.name if org else "PropAIrty", ref=f"INS-{inspection.id:04d}")
    ctx.update({
        "inspection": inspection,
        "property_name": prop.name if prop else "Unknown",
        "property_address": (
            f"{prop.address_line1}, {prop.city}, {prop.postcode}" if prop else ""
        ),
        "unit_name": unit.name if unit else "Unknown",
        "type_label": inspection.type.replace("_", " ").title(),
        "scheduled_date": inspection.scheduled_date.strftime("%-d %B %Y") if inspection.scheduled_date else "",
        "completed_date": inspection.completed_date.strftime("%-d %B %Y") if inspection.completed_date else "",
        "tenant_name": tenant.full_name if tenant else "Vacant",
        "rooms": inspection.rooms,
        "condition_badge": {
            "excellent": ("#dcfce7", "#15803d"),
            "good": ("#dbeafe", "#1d4ed8"),
            "fair": ("#fef9c3", "#a16207"),
            "poor": ("#fee2e2", "#dc2626"),
        },
    })
    return _render_pdf("documents/inspection_report.html", ctx)


def generate_deposit_receipt(lease, tenant, unit, org) -> bytes:
    ctx = _base_context(org.name, ref=f"DEP-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "start_date": lease.start_date.strftime("%-d %B %Y"),
        "deposit": f"{lease.deposit:,.2f}" if lease.deposit else "0.00",
    })
    return _render_pdf("documents/deposit_receipt.html", ctx)
