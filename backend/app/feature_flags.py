"""
Feature flag registry and helpers.

Every flag defaults to True (enabled) unless explicitly set to False in the DB.
This means new orgs get all features without needing a seed step.
"""

# Registry: flag_key → {label, group, group_label, premium_only}
FEATURE_REGISTRY = {
    # ── Tenant portal ────────────────────────────────────────────────────────
    "tenant_payments":        {"label": "Payments (Stripe)",     "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_messages":        {"label": "Messages",              "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_maintenance":     {"label": "Maintenance Requests",  "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_documents":       {"label": "Documents & E-Signing", "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_deposit":         {"label": "Deposit View",          "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_rent_statement":  {"label": "Rent Statement",        "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_meters":          {"label": "Meter Readings",        "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_inspections":     {"label": "Inspections",           "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_utilities":       {"label": "Utilities",             "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_emergency":       {"label": "Emergency Contacts",    "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_referencing":     {"label": "Referencing",           "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": True},
    "tenant_right_to_rent":   {"label": "Right to Rent",         "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_move_out":        {"label": "Move Out Checklist",    "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},
    "tenant_notices":         {"label": "Notices",               "group": "tenant",     "group_label": "Tenant Portal",     "premium_only": False},

    # ── Landlord portal ──────────────────────────────────────────────────────
    "landlord_financials":    {"label": "Financials",            "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_arrears":       {"label": "Arrears",               "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_maintenance":   {"label": "Maintenance View",      "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_compliance":    {"label": "Compliance",            "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_notices":       {"label": "Notices",               "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_renewals":      {"label": "Renewals",              "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_inspections":   {"label": "Inspections",           "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_documents":     {"label": "Documents",             "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_statements":    {"label": "Statements",            "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": True},
    "landlord_messages":      {"label": "Messages",              "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": False},
    "landlord_cfo":           {"label": "CFO Dashboard",         "group": "landlord",   "group_label": "Landlord Portal",   "premium_only": True},

    # ── Contractor portal ────────────────────────────────────────────────────
    "contractor_messages":    {"label": "Messages",              "group": "contractor", "group_label": "Contractor Portal", "premium_only": False},
    "contractor_calendar":    {"label": "Calendar",              "group": "contractor", "group_label": "Contractor Portal", "premium_only": False},
    "contractor_invoicing":   {"label": "Invoicing",             "group": "contractor", "group_label": "Contractor Portal", "premium_only": True},

    # ── Public website ───────────────────────────────────────────────────────
    "public_listings":        {"label": "Property Listings",     "group": "public",     "group_label": "Public Website",    "premium_only": False},
    "public_valuation":       {"label": "Valuation Tool",        "group": "public",     "group_label": "Public Website",    "premium_only": False},
    "public_blog":            {"label": "Blog",                  "group": "public",     "group_label": "Public Website",    "premium_only": False},
    "public_reviews":         {"label": "Reviews Page",          "group": "public",     "group_label": "Public Website",    "premium_only": False},
    "public_contact":         {"label": "Contact Form",          "group": "public",     "group_label": "Public Website",    "premium_only": False},
    "public_tenant_advice":   {"label": "Tenant Advice",         "group": "public",     "group_label": "Public Website",    "premium_only": False},
    "public_landlord_advice": {"label": "Landlord Advice",       "group": "public",     "group_label": "Public Website",    "premium_only": False},

    # ── Agent portal ─────────────────────────────────────────────────────────
    "agent_ai_tools":         {"label": "AI Tools (Intelligence section)", "group": "agent", "group_label": "Agent Portal", "premium_only": True},
    "agent_analytics":        {"label": "Analytics",             "group": "agent",      "group_label": "Agent Portal",      "premium_only": False},
    "agent_dispatch":         {"label": "Dispatch",              "group": "agent",      "group_label": "Agent Portal",      "premium_only": False},
    "agent_ppm":              {"label": "PPM Schedule",          "group": "agent",      "group_label": "Agent Portal",      "premium_only": False},
    "agent_audit_log":        {"label": "Audit Trail",           "group": "agent",      "group_label": "Agent Portal",      "premium_only": True},
    "agent_workflows":        {"label": "Workflows",             "group": "agent",      "group_label": "Agent Portal",      "premium_only": True},
    "agent_checklists":       {"label": "Checklists",            "group": "agent",      "group_label": "Agent Portal",      "premium_only": False},
    "agent_cfo":              {"label": "CFO Dashboard",         "group": "agent",      "group_label": "Agent Portal",      "premium_only": True},
    "agent_alerts":           {"label": "Alerts Inbox",          "group": "agent",      "group_label": "Agent Portal",      "premium_only": False},
    "agent_renewals":         {"label": "Renewals",              "group": "agent",      "group_label": "Agent Portal",      "premium_only": False},
    "agent_accounting":       {"label": "Accounting & Tax",      "group": "agent",      "group_label": "Agent Portal",      "premium_only": False},
}


def get_org_features(db, org_id: int, prefix: str = None) -> dict:
    """
    Return {flag_key: bool} for an org, filtered by optional prefix.
    Any flag not in the DB defaults to True.
    """
    from app.models.feature_flag import OrgFeatureFlag

    rows = db.query(OrgFeatureFlag).filter(OrgFeatureFlag.organisation_id == org_id).all()
    overrides = {r.flag_key: r.enabled for r in rows}

    result = {}
    for key in FEATURE_REGISTRY:
        if prefix and not key.startswith(prefix):
            continue
        result[key] = overrides.get(key, True)
    return result
