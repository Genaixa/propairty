"""
Scenario: Sprint 3 new features — full coverage

  1. Applicant preferences + follow-up reminders
  2. Checklists (create, list, toggle items, add item, delete item, delete checklist)
  3. Agent performance analytics
  4. Audit trail (entries created on tenant create, maintenance update; read + filter)
  5. Landlord management agreement PDF generation
  6. SMS test endpoint (no Twilio configured in dev → returns gracefully)
"""
import sys, os, secrets
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENV_FILE", "/root/propairty/backend/.env.production")
from base import BaseGolem, BASE_URL
import requests


class AgentGolem(BaseGolem):
    name = "AgentGoilem"
    email = "agentgoilem@propairty.co.uk"
    login_url = "/api/auth/token"


def run(verbose: bool = True) -> list[dict]:
    print("\n" + "="*60)
    print("SCENARIO: Sprint 3 Features — Full Coverage")
    print("="*60)

    agent = AgentGolem(verbose=verbose).login()

    # ── shared fixtures ───────────────────────────────────────────────────────
    props = agent.get("/api/properties").json()
    unit, prop = None, None
    for p in props:
        for u in p.get("units", []):
            unit = u; prop = p; break
        if unit:
            break
    agent.check("have at least one property/unit", bool(unit))
    unit_id = unit["id"] if unit else None
    prop_id  = prop["id"] if prop else None

    landlords = agent.get("/api/landlord/landlords").json()
    agent.check("have at least one landlord", len(landlords) > 0)
    landlord_id = landlords[0]["id"] if landlords else None

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Applicant preferences & follow-up
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 1: Applicant preferences & follow-up reminders ──")

    r = agent.post("/api/applicants", {
        "full_name": "[GOLEM] Prefs Test",
        "email": f"golem-prefs-{secrets.token_hex(4)}@test.co",
        "source": "Online", "status": "new", "unit_id": unit_id,
    })
    app = agent.expect(r, 200, "create applicant for preferences test")
    app_id = app.get("id")
    agent.check("applicant created", bool(app_id))

    # New preference fields should default to None/empty
    agent.check("preferred_areas default None/empty", app.get("preferred_areas") in (None, ""))
    agent.check("must_haves default None/empty",      app.get("must_haves") in (None, ""))
    agent.check("follow_up_date default None",         app.get("follow_up_date") is None)
    agent.check("assigned_agent default None/empty",   app.get("assigned_agent") in (None, ""))

    # Update all preference fields
    r = agent.put(f"/api/applicants/{app_id}", {
        "full_name": "[GOLEM] Prefs Test", "email": app["email"],
        "source": "Online", "status": "new", "unit_id": unit_id,
        "preferred_areas": "Jesmond,Heaton",
        "must_haves":      "Parking,Garden",
        "dislikes":        "Top floor",
        "min_bedrooms":    2,
        "max_bedrooms":    4,
        "follow_up_date":  "2026-04-20",
        "follow_up_note":  "Call back after viewing",
        "assigned_agent":  "Jane Smith",
    })
    upd = agent.expect(r, 200, "update applicant preferences")
    agent.check("preferred_areas saved",  upd.get("preferred_areas") == "Jesmond,Heaton")
    agent.check("must_haves saved",       upd.get("must_haves")      == "Parking,Garden")
    agent.check("dislikes saved",         upd.get("dislikes")        == "Top floor")
    agent.check("min_bedrooms saved",     upd.get("min_bedrooms")    == 2)
    agent.check("max_bedrooms saved",     upd.get("max_bedrooms")    == 4)
    agent.check("follow_up_date saved",   upd.get("follow_up_date") is not None)
    agent.check("follow_up_note saved",   upd.get("follow_up_note")  == "Call back after viewing")
    agent.check("assigned_agent saved",   upd.get("assigned_agent")  == "Jane Smith")

    # Set a past follow-up date → should appear in /follow-ups-due
    r = agent.put(f"/api/applicants/{app_id}", {
        "full_name": "[GOLEM] Prefs Test", "email": app["email"],
        "source": "Online", "status": "new", "unit_id": unit_id,
        "follow_up_date": "2020-01-01",
    })
    agent.expect(r, 200, "set past follow-up date")

    r = agent.get("/api/applicants/follow-ups-due")
    due = agent.expect(r, 200, "get follow-ups-due")
    agent.check("follow-ups-due returns list", isinstance(due, list))
    found_due = any(a.get("id") == app_id for a in due)
    agent.check("past follow-up in due list", found_due,
                f"app_id={app_id} not in {[a.get('id') for a in due][:10]}")

    # Future follow-up should NOT appear
    r = agent.put(f"/api/applicants/{app_id}", {
        "full_name": "[GOLEM] Prefs Test", "email": app["email"],
        "source": "Online", "status": "new", "unit_id": unit_id,
        "follow_up_date": "2099-12-31",
    })
    agent.expect(r, 200, "set future follow-up date")
    r = agent.get("/api/applicants/follow-ups-due")
    due2 = agent.expect(r, 200, "get follow-ups-due with future date")
    still_in = any(a.get("id") == app_id for a in due2)
    agent.check("future follow-up NOT in due list", not still_in,
                f"app_id={app_id} should not appear with future date")

    # Terminal statuses should not appear in due list
    r = agent.put(f"/api/applicants/{app_id}", {
        "full_name": "[GOLEM] Prefs Test", "email": app["email"],
        "source": "Online", "status": "rejected", "unit_id": unit_id,
        "follow_up_date": "2020-01-01",
    })
    agent.expect(r, 200, "set rejected status")
    r = agent.get("/api/applicants/follow-ups-due")
    due3 = agent.expect(r, 200, "follow-ups-due excludes rejected")
    in_due3 = any(a.get("id") == app_id for a in due3)
    agent.check("rejected applicant excluded from due list", not in_due3,
                f"rejected applicant should not appear in follow-ups-due")

    agent.delete(f"/api/applicants/{app_id}")

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Checklists
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 2: Checklists CRUD ──")

    # Create pre_showing — default items expected
    r = agent.post("/api/checklists", {
        "name": "[GOLEM] Pre-Showing Test",
        "checklist_type": "pre_showing",
        "property_id": prop_id,
    })
    cl = agent.expect(r, 200, "create pre_showing checklist")
    cl_id = cl.get("id")
    agent.check("checklist created with id",          bool(cl_id))
    agent.check("checklist type correct",             cl.get("checklist_type") == "pre_showing")
    agent.check("checklist linked to property",       cl.get("property_id")    == prop_id)
    agent.check("pre_showing has 9 default items",    len(cl.get("items", [])) == 9,
                f"got {len(cl.get('items', []))}")
    agent.check("progress starts 0/9",               cl.get("progress") == "0/9",
                f"progress={cl.get('progress')}")

    # List + filter by type
    r = agent.get("/api/checklists")
    all_cls = agent.expect(r, 200, "list all checklists")
    agent.check("list is array",  isinstance(all_cls, list))
    agent.check("new checklist in list", any(c.get("id") == cl_id for c in all_cls))

    r = agent.get("/api/checklists?checklist_type=pre_showing")
    filtered = agent.expect(r, 200, "filter by type")
    agent.check("type filter correct", all(c.get("checklist_type") == "pre_showing" for c in filtered))

    r = agent.get(f"/api/checklists?property_id={prop_id}")
    prop_filtered = agent.expect(r, 200, "filter by property")
    agent.check("property filter returns results", any(c.get("id") == cl_id for c in prop_filtered))

    # Get single
    r = agent.get(f"/api/checklists/{cl_id}")
    single = agent.expect(r, 200, "get single checklist")
    agent.check("single checklist id ok", single.get("id") == cl_id)

    # Toggle first item → checked
    first_item = cl["items"][0]
    item_id = first_item["id"]
    r = agent.patch(f"/api/checklists/{cl_id}/items/{item_id}",
                    json_body={"checked": True, "checked_by": "GolemAgent"})
    ticked = agent.expect(r, 200, "tick checklist item")
    agent.check("item checked=True",       ticked.get("checked")    == True)
    agent.check("checked_at set",          ticked.get("checked_at") is not None)
    agent.check("checked_by saved",        ticked.get("checked_by") == "GolemAgent")

    # Progress now 1/9
    r = agent.get(f"/api/checklists/{cl_id}")
    with_prog = agent.expect(r, 200, "get progress after tick")
    agent.check("progress is 1/9 after tick", with_prog.get("progress") == "1/9",
                f"got {with_prog.get('progress')}")

    # Untick
    r = agent.patch(f"/api/checklists/{cl_id}/items/{item_id}", json_body={"checked": False})
    unticked = agent.expect(r, 200, "untick item")
    agent.check("item unchecked",     unticked.get("checked")    == False)
    agent.check("checked_at cleared", unticked.get("checked_at") is None)
    agent.check("checked_by cleared", unticked.get("checked_by") is None)

    # Add custom item
    r = agent.post(f"/api/checklists/{cl_id}/items", {"label": "Golem custom item"})
    added = agent.expect(r, 200, "add custom item")
    new_item_id = added.get("id")
    agent.check("custom item id returned",   bool(new_item_id))
    agent.check("custom item label correct", added.get("label")   == "Golem custom item")
    agent.check("custom item unchecked",     added.get("checked") == False)

    # Count should now be 10
    r = agent.get(f"/api/checklists/{cl_id}")
    with_added = agent.expect(r, 200, "checklist after add item")
    agent.check("item count now 10", len(with_added.get("items", [])) == 10,
                f"got {len(with_added.get('items', []))}")

    # Delete custom item
    r = agent.delete(f"/api/checklists/{cl_id}/items/{new_item_id}")
    agent.expect(r, 200, "delete custom item")
    r = agent.get(f"/api/checklists/{cl_id}")
    after_del = agent.expect(r, 200, "checklist after delete item")
    agent.check("deleted item gone", not any(i.get("id") == new_item_id for i in after_del.get("items", [])))
    agent.check("count back to 9",   len(after_del.get("items", [])) == 9)

    # 404 for wrong item on right checklist
    r = agent.patch(f"/api/checklists/{cl_id}/items/999999", json_body={"checked": True})
    agent.check("404 for missing item", r.status_code == 404, f"got {r.status_code}")

    # 404 for wrong checklist
    r = agent.get("/api/checklists/999999")
    agent.check("404 for missing checklist", r.status_code == 404, f"got {r.status_code}")

    # Default item counts per type
    for typ, expected_count in [("pre_move_in", 13), ("inspection", 10), ("custom", 0)]:
        r = agent.post("/api/checklists", {"name": f"[GOLEM] {typ}", "checklist_type": typ})
        c = agent.expect(r, 200, f"create {typ} checklist")
        cid = c.get("id")
        agent.check(f"{typ} has {expected_count} default items",
                    len(c.get("items", [])) == expected_count,
                    f"got {len(c.get('items', []))}")
        if cid:
            agent.delete(f"/api/checklists/{cid}")

    # Delete main test checklist
    r = agent.delete(f"/api/checklists/{cl_id}")
    agent.expect(r, 200, "delete checklist")
    r = agent.get(f"/api/checklists/{cl_id}")
    agent.check("deleted checklist 404", r.status_code == 404, f"got {r.status_code}")

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Agent performance analytics
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 3: Agent performance analytics ──")

    r = agent.get("/api/analytics/agent-performance")
    perf = agent.expect(r, 200, "get agent performance")
    agent.check("response is dict",        isinstance(perf, dict))
    agent.check("has agents list",         "agents" in perf)
    agent.check("agents is a list",        isinstance(perf.get("agents"), list))
    agent.check("has follow_ups_due",      "follow_ups_due" in perf)
    agent.check("has total_applicants",    "total_applicants" in perf)
    agent.check("has total_converted",     "total_converted" in perf)
    agent.check("total_applicants >= 0",   perf.get("total_applicants", -1) >= 0)
    agent.check("total_converted >= 0",    perf.get("total_converted",  -1) >= 0)
    agent.check("follow_ups_due >= 0",     perf.get("follow_ups_due",   -1) >= 0)

    # Per-agent structure check
    for a in perf.get("agents", []):
        agent.check("agent has 'agent' key",      "agent" in a)
        agent.check("agent has 'total'",          "total" in a)
        agent.check("agent has 'conversion_rate'","conversion_rate" in a)
        agent.check("agent has 'enquiries'",      "enquiries" in a)
        agent.check("agent has 'viewings'",       "viewings" in a)
        agent.check("agent has 'referencing'",    "referencing" in a)
        agent.check("agent has 'converted'",      "converted" in a)
        agent.check("conversion_rate in 0-100",
                    0 <= a.get("conversion_rate", -1) <= 100)
        break  # structure check on first agent only

    # Create applicant → should surface in agent performance
    tag = secrets.token_hex(4)
    r = agent.post("/api/applicants", {
        "full_name": f"[GOLEM] PerfAgent {tag}",
        "email": f"golem-perf-{tag}@test.co",
        "source": "Rightmove", "status": "referencing",
        "unit_id": unit_id,
        "assigned_agent": f"GolemAgent-{tag}",
    })
    perf_app = agent.expect(r, 200, "create applicant with assigned_agent")
    perf_app_id = perf_app.get("id")

    r = agent.get("/api/analytics/agent-performance")
    perf2 = agent.expect(r, 200, "agent performance after adding applicant")
    names = [a.get("agent") for a in perf2.get("agents", [])]
    agent.check("new agent appears in list", f"GolemAgent-{tag}" in names, f"names={names}")

    ga = next((a for a in perf2["agents"] if a["agent"] == f"GolemAgent-{tag}"), None)
    agent.check("new agent total=1",       ga is not None and ga.get("total") == 1)
    agent.check("referencing count=1",     ga is not None and ga.get("referencing") == 1)
    agent.check("conversion_rate=0",       ga is not None and ga.get("conversion_rate") == 0.0)

    agent.delete(f"/api/applicants/{perf_app_id}")

    # ─────────────────────────────────────────────────────────────────────────
    # 4. Audit trail
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 4: Audit trail ──")

    r = agent.get("/api/audit?days=7")
    entries = agent.expect(r, 200, "get audit log")
    agent.check("audit log is list",  isinstance(entries, list))
    # Verify structure on first entry if present
    for e in entries[:1]:
        for field in ("id", "action", "entity_type", "user_name", "created_at"):
            agent.check(f"audit entry has '{field}'", field in e)

    # Create tenant → audit entry
    tag2 = secrets.token_hex(4)
    r = agent.post("/api/tenants", {
        "full_name": f"[GOLEM] AuditTenant {tag2}",
        "email": f"golem-audit-{tag2}@test.co",
    })
    new_t = agent.expect(r, 200, "create tenant to trigger audit")
    t_id = new_t.get("id")
    agent.check("tenant created", bool(t_id))

    r = agent.get(f"/api/audit?days=1&entity_type=tenant&search={tag2}")
    aud_t = agent.expect(r, 200, "audit entries for new tenant")
    agent.check("audit entry written for tenant create",  len(aud_t) > 0,
                f"no entries for tag={tag2}")
    if aud_t:
        e = aud_t[0]
        agent.check("action=created",              e.get("action")      == "created")
        agent.check("entity_type=tenant",          e.get("entity_type") == "tenant")
        agent.check("entity_name contains tag",    tag2 in (e.get("entity_name") or ""))
        agent.check("user_name present",           bool(e.get("user_name")))
        agent.check("created_at is ISO string",    "T" in (e.get("created_at") or ""))

    # action filter
    r = agent.get("/api/audit?days=30&action=created")
    created_ents = agent.expect(r, 200, "filter audit by action=created")
    agent.check("action=created filter consistent",
                all(e.get("action") == "created" for e in created_ents))

    # entity_type filter
    r = agent.get("/api/audit?days=30&entity_type=tenant")
    tenant_ents = agent.expect(r, 200, "filter audit by entity_type=tenant")
    agent.check("entity_type=tenant filter consistent",
                all(e.get("entity_type") == "tenant" for e in tenant_ents))

    # search filter
    r = agent.get(f"/api/audit?days=1&search={tag2}")
    searched = agent.expect(r, 200, "audit search filter")
    agent.check("search filter finds tenant record", len(searched) > 0)

    # stats endpoint
    r = agent.get("/api/audit/stats?days=30")
    stats = agent.expect(r, 200, "audit stats")
    agent.check("stats is list", isinstance(stats, list))
    for s in stats[:1]:
        agent.check("stat has action",      "action"      in s)
        agent.check("stat has entity_type", "entity_type" in s)
        agent.check("stat has count",       "count"       in s)
        agent.check("stat count positive",  s.get("count", 0) > 0)

    # Maintenance update → audit entry
    r = agent.post("/api/maintenance", {
        "title": f"[GOLEM] AuditMaint {tag2}",
        "description": "Audit test",
        "priority": "low",
        "status": "open",
        "unit_id": unit_id,
    })
    maint = agent.expect(r, 200, "create maintenance for audit test")
    maint_id = maint.get("id") if isinstance(maint, dict) else None

    if maint_id:
        r = agent.put(f"/api/maintenance/{maint_id}", {
            "title": f"[GOLEM] AuditMaint {tag2}",
            "description": "Audit test",
            "priority": "low",
            "status": "in_progress",
            "unit_id": unit_id,
        })
        agent.expect(r, 200, "update maintenance status to in_progress")

        r = agent.get(f"/api/audit?days=1&entity_type=maintenance&search={tag2}")
        m_audit = agent.expect(r, 200, "audit entries for maintenance update")
        agent.check("audit entry for maintenance update",  len(m_audit) > 0)
        if m_audit:
            ea = m_audit[0]
            agent.check("maintenance audit action=updated", ea.get("action") == "updated")
            agent.check("maintenance audit detail has status",
                        "in_progress" in (ea.get("detail") or ""))
        agent.delete(f"/api/maintenance/{maint_id}")

    # Unauthenticated request should be rejected
    r2 = requests.get(f"{BASE_URL}/api/audit")
    agent.check("unauthenticated audit access rejected",
                r2.status_code in (401, 403, 422), f"got {r2.status_code}")

    # ─────────────────────────────────────────────────────────────────────────
    # 5. Landlord management agreement PDF
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 5: Landlord management agreement PDF ──")

    if not landlord_id:
        agent.check("skip MGA — no landlord in test org", True)
    else:
        r = agent.post("/api/documents/generate-management-agreement", {
            "landlord_id":          landlord_id,
            "management_fee_pct":   10.0,
            "tenant_find_fee":      "One month's rent (inc. VAT)",
            "renewal_fee":          "£150 + VAT",
            "maintenance_limit":    250,
            "notice_period":        60,
            "inspection_frequency": "twice per year",
        })
        agent.check("MGA returns 200", r.status_code == 200,
                    f"got {r.status_code}: {r.text[:200]}")
        agent.check("MGA content-type is PDF",
                    r.headers.get("content-type", "").startswith("application/pdf"),
                    f"ct={r.headers.get('content-type')}")
        agent.check("PDF is non-empty (>1 kB)", len(r.content) > 1000,
                    f"len={len(r.content)}")
        cd = r.headers.get("content-disposition", "")
        agent.check("Content-Disposition has attachment", "attachment" in cd)
        agent.check("filename contains ManagementAgreement", "ManagementAgreement" in cd,
                    f"cd={cd}")

        # Custom fee overrides
        r2 = agent.post("/api/documents/generate-management-agreement", {
            "landlord_id":          landlord_id,
            "management_fee_pct":   12.5,
            "tenant_find_fee":      "Half month's rent",
            "renewal_fee":          "£200 + VAT",
            "maintenance_limit":    500,
            "notice_period":        30,
            "inspection_frequency": "quarterly",
        })
        agent.check("MGA with custom fees returns 200", r2.status_code == 200,
                    f"got {r2.status_code}")
        agent.check("custom fee PDF non-empty", len(r2.content) > 1000)

        # 404 for non-existent landlord
        r3 = agent.post("/api/documents/generate-management-agreement", {"landlord_id": 999999})
        agent.check("404 for unknown landlord", r3.status_code == 404, f"got {r3.status_code}")

        # 422 for missing landlord_id
        r4 = agent.post("/api/documents/generate-management-agreement", {})
        agent.check("422 for missing landlord_id", r4.status_code == 422, f"got {r4.status_code}")

    # ─────────────────────────────────────────────────────────────────────────
    # 6. SMS test endpoint
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 6: SMS test endpoint ──")

    r = agent.post("/api/system/test-sms", {"to": "+447700900000"})
    agent.check("test-sms returns 200", r.status_code == 200,
                f"got {r.status_code}: {r.text[:200]}")
    resp = r.json() if r.status_code == 200 else {}
    agent.check("response has 'ok' field",      "ok"      in resp)
    agent.check("response has 'message' field", "message" in resp)
    agent.check("ok is boolean",                isinstance(resp.get("ok"), bool))
    agent.check("message is string",            isinstance(resp.get("message"), str))

    # UK number normalisation — bare 07 number should not cause a server error
    r = agent.post("/api/system/test-sms", {"to": "07700 900123"})
    agent.check("UK 07 number accepted (no crash)", r.status_code == 200,
                f"got {r.status_code}: {r.text[:200]}")

    # Missing 'to' field → 422
    r = agent.post("/api/system/test-sms", {})
    agent.check("missing 'to' is 422", r.status_code == 422, f"got {r.status_code}")

    # Unauthenticated
    r2 = requests.post(f"{BASE_URL}/api/system/test-sms",
                       json={"to": "+447700900000"},
                       headers={"Authorization": "Bearer bad_token_xyz"})
    agent.check("unauthenticated SMS rejected",
                r2.status_code in (401, 403, 422), f"got {r2.status_code}")

    # ─────────────────────────────────────────────────────────────────────────
    # Results
    # ─────────────────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    s = agent.summary()
    failures = s["failures"]
    if not failures:
        print("ALL CHECKS PASSED ✓")
        print("="*60)
    else:
        print(f"FAILURES ({len(failures)}):")
        for f in failures:
            print(f"  {f}")
        print("="*60)

    return agent.log


if __name__ == "__main__":
    run()
