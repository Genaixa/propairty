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


def _inject_sig(ctx: dict, signature_block: str | None):
    """Attach optional signature block to context."""
    ctx["signature_block"] = signature_block or ""


def _base_context(org_name: str, ref: str = "") -> dict:
    return {
        "org_name": org_name,
        "today": date.today().strftime("%-d %B %Y"),
        "ref": ref,
    }


def generate_ast(lease, tenant, unit, org, deposit_override=None, signature_block=None) -> bytes:
    deposit_amount = deposit_override if deposit_override is not None else (lease.deposit or 0)
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
        "deposit": f"{deposit_amount:,.2f}",
        "is_periodic": lease.is_periodic,
    })
    _inject_sig(ctx, signature_block)
    return _render_pdf("documents/ast_agreement.html", ctx)


def generate_section21(lease, tenant, unit, org, notice_months: int = 2, checks: dict = None, signature_block=None) -> bytes:
    today = date.today()
    possession_date = today + timedelta(days=notice_months * 30)
    ctx = _base_context(org.name, ref=f"S21-{lease.id:04d}")
    checks = checks or {}
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "start_date": lease.start_date.strftime("%-d %B %Y"),
        "possession_date": possession_date.strftime("%-d %B %Y"),
        "check_gas": checks.get("gas_cert") == "pass",
        "check_epc": checks.get("epc") == "pass",
        "check_how_to_rent": checks.get("how_to_rent") == "pass",
        "check_deposit": checks.get("deposit") in ("pass", "warn", "n/a"),
        "any_check_confirmed": any(checks.get(k) in ("pass", "warn", "n/a") for k in ("gas_cert", "epc", "how_to_rent", "deposit")),
    })
    _inject_sig(ctx, signature_block)
    return _render_pdf("documents/section_21.html", ctx)


def generate_section8(lease, tenant, unit, org, arrears_amount: float, custom_notes: str = "", signature_block=None) -> bytes:
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
    _inject_sig(ctx, signature_block)
    return _render_pdf("documents/section_8.html", ctx)


def generate_rent_increase(lease, tenant, unit, org, new_rent: float, effective_date: date, custom_notes: str = "", old_rent: float = None, signature_block=None) -> bytes:
    current = old_rent if old_rent is not None else lease.monthly_rent
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
    _inject_sig(ctx, signature_block)
    return _render_pdf("documents/rent_increase.html", ctx)


def generate_deed_of_surrender(lease, tenant, unit, org, surrender_date=None, deposit=None,
                               deductions=None, condition_notes="", outstanding_rent=0.0,
                               keys_returned="", signature_block=None) -> bytes:
    from datetime import date as _date
    dep_amount = deposit.amount if deposit else (lease.deposit or 0)
    dep_scheme = deposit.scheme if deposit else "Tenancy Deposit Scheme (TDS)"
    dep_ref = deposit.scheme_reference if deposit else ""
    deductions = deductions or []
    total_ded = sum(d.get("amount", 0) for d in deductions)
    dep_return = max(0, dep_amount - total_ded - outstanding_rent)
    ctx = _base_context(org.name, ref=f"SUR-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "start_date": lease.start_date.strftime("%-d %B %Y"),
        "surrender_date": surrender_date.strftime("%-d %B %Y") if surrender_date else _date.today().strftime("%-d %B %Y"),
        "deposit_amount": f"{dep_amount:,.2f}",
        "deposit_scheme": dep_scheme,
        "deposit_ref": dep_ref,
        "deductions": deductions,
        "total_deductions": total_ded,
        "deposit_return": dep_return,
        "condition_notes": condition_notes,
        "outstanding_rent": outstanding_rent,
        "keys_returned": keys_returned,
    })
    _inject_sig(ctx, signature_block)
    return _render_pdf("documents/deed_of_surrender.html", ctx)


def generate_nosp(lease, tenant, unit, org, arrears_amount: float = 0.0, ground_8=True,
                  ground_10=False, ground_11=False, other_grounds="", particulars="",
                  payment_history="", notice_days=14, service_method="hand", signature_block=None) -> bytes:
    weekly_rent = lease.monthly_rent * 12 / 52
    arrears_weeks = round(arrears_amount / weekly_rent, 1) if weekly_rent else 0
    if not particulars:
        particulars = (
            f"The Tenant has failed to pay rent due under the tenancy agreement. "
            f"As at the date of this notice, the total rent outstanding is £{arrears_amount:,.2f}, "
            f"representing approximately {arrears_weeks} weeks of rent. "
            f"The Landlord has made repeated requests for payment which have not been met."
        )
    ctx = _base_context(org.name, ref=f"NOSP-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "start_date": lease.start_date.strftime("%-d %B %Y"),
        "monthly_rent": f"{lease.monthly_rent:,.2f}",
        "arrears_amount": arrears_amount,
        "arrears_weeks": arrears_weeks,
        "ground_8": ground_8,
        "ground_10": ground_10,
        "ground_11": ground_11,
        "other_grounds": other_grounds,
        "particulars": particulars,
        "payment_history": payment_history,
        "notice_days": notice_days,
        "service_method": service_method,
    })
    _inject_sig(ctx, signature_block)
    return _render_pdf("documents/nosp.html", ctx)


def generate_deposit_dispute(lease, tenant, unit, org, deposit=None, claim_items=None,
                              checkin_notes="", checkout_notes="", checkin_items=None,
                              timeline=None, supporting_docs=None, rent_arrears=0.0) -> bytes:
    dep_amount = deposit.amount if deposit else (lease.deposit or 0)
    dep_scheme = deposit.scheme if deposit else "Tenancy Deposit Scheme (TDS)"
    dep_ref = deposit.scheme_reference if deposit else ""
    dep_protected = deposit.protected_date.strftime("%-d %B %Y") if (deposit and deposit.protected_date) else None
    claim_items = claim_items or []
    claimed_total = sum(i.get("amount", 0) for i in claim_items)
    agreed_return = max(0, dep_amount - claimed_total)
    ctx = _base_context(org.name, ref=f"DD-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "start_date": lease.start_date.strftime("%-d %B %Y"),
        "end_date": lease.end_date.strftime("%-d %B %Y") if lease.end_date else "Periodic",
        "monthly_rent": f"{lease.monthly_rent:,.2f}",
        "deposit_amount": dep_amount,
        "deposit_scheme": dep_scheme,
        "deposit_ref": dep_ref,
        "deposit_protected_date": dep_protected,
        "claim_items": claim_items,
        "claimed_amount": claimed_total,
        "agreed_return": agreed_return,
        "checkin_notes": checkin_notes,
        "checkout_notes": checkout_notes,
        "checkin_items": checkin_items or [],
        "timeline": timeline or [],
        "supporting_docs": supporting_docs or [],
        "rent_arrears": rent_arrears,
    })
    return _render_pdf("documents/deposit_dispute.html", ctx)


def generate_hmo_guidance(prop, org, units=None, compliance_certs=None) -> bytes:
    units = units or []
    bedroom_count = len(units) if units else "Not recorded"
    mandatory = len(units) >= 5 if units else False
    additional = len(units) in (3, 4) if units else False
    cert_list = []
    for c in (compliance_certs or []):
        from datetime import date as _date
        status = "expired" if (c.expiry_date and c.expiry_date < _date.today()) else "valid"
        cert_list.append({
            "cert_type": c.cert_type,
            "status": status,
            "expiry_date": c.expiry_date.strftime("%-d %B %Y") if c.expiry_date else None,
        })
    ctx = _base_context(org.name, ref=f"HMO-{prop.id:04d}")
    ctx.update({
        "property_address": f"{prop.address_line1}, {prop.city}, {prop.postcode}",
        "property_type": getattr(prop, "property_type", "HMO"),
        "bedroom_count": bedroom_count,
        "storey_count": getattr(prop, "storeys", None),
        "mandatory_licence": mandatory,
        "additional_licence": additional and not mandatory,
        "compliance_certs": cert_list,
    })
    return _render_pdf("documents/hmo_guidance.html", ctx)


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
        "renewal_status": renewal.status or "sent",
        "responded_at": renewal.responded_at.strftime("%-d %B %Y at %H:%M UTC") if renewal.responded_at else None,
        "responded_via": renewal.responded_via or None,
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


def generate_management_agreement(
    landlord,
    org,
    properties: list,
    management_fee_pct: float = 10.0,
    tenant_find_fee: str = "One month's rent (inc. VAT)",
    renewal_fee: str = "£150 + VAT",
    maintenance_limit: int = 250,
    notice_period: int = 60,
    inspection_frequency: str = "twice per year",
) -> bytes:
    landlord_addr_parts = [
        landlord.address_line1, landlord.address_line2,
        landlord.city, landlord.postcode,
    ]
    landlord_address = ", ".join(p for p in landlord_addr_parts if p)

    property_list = ", ".join(
        f"{p.address_line1}, {p.city} {p.postcode}" for p in properties
    ) if properties else "As agreed"

    ctx = _base_context(org.name, ref=f"MGA-{landlord.id:04d}")
    ctx.update({
        "org_address": getattr(org, "address", "") or "",
        "org_email": getattr(org, "email", "") or "",
        "landlord_name": landlord.full_name,
        "landlord_company": landlord.company_name or "",
        "landlord_address": landlord_address or "—",
        "landlord_email": landlord.email,
        "landlord_phone": landlord.phone or "",
        "property_list": property_list,
        "management_fee_pct": management_fee_pct,
        "tenant_find_fee": tenant_find_fee,
        "renewal_fee": renewal_fee,
        "maintenance_limit": f"{maintenance_limit:,}",
        "notice_period": notice_period,
        "inspection_frequency": inspection_frequency,
    })
    return _render_pdf("documents/management_agreement.html", ctx)


def generate_deposit_receipt(lease, tenant, unit, org, signature_block=None) -> bytes:
    ctx = _base_context(org.name, ref=f"DEP-{lease.id:04d}")
    ctx.update({
        "tenant_name": tenant.full_name,
        "property_address": f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}",
        "start_date": lease.start_date.strftime("%-d %B %Y"),
        "deposit": f"{lease.deposit:,.2f}" if lease.deposit else "0.00",
    })
    _inject_sig(ctx, signature_block)
    return _render_pdf("documents/deposit_receipt.html", ctx)
