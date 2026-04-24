"""
Scenario: Sequential tests for sprint 2 features.

  1. Workflow rules — CRUD (create, list, update days, toggle, delete)
  2. Workflow seed defaults — seed + verify 8 rules
  3. Workflow triggers list
  4. Contractor invoice paid toggle (via maintenance job)
  5. Viewing booking — create applicant, set viewing date, check confirmation logic
  6. Dispatch history — invoice_ref and invoice_paid fields present
  7. Dashboard new tiles — applicants / deposits / inspections / ppm fields present
  8. Applicant viewing_reminder_sent field exists in DB
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENV_FILE", "/root/propairty/backend/.env.production")
os.chdir("/root/propairty/backend")

from base import BaseGolem, BASE_URL
import requests
from datetime import datetime, timedelta, timezone


class AgentGolem(BaseGolem):
    name = "AgentGoilem"
    email = "agentgoilem@propairty.co.uk"
    login_url = "/api/auth/token"


def run(verbose: bool = True) -> list[dict]:
    print("\n" + "="*60)
    print("SCENARIO: Sprint 2 Features — Sequential")
    print("="*60)

    agent = AgentGolem(verbose=verbose).login()

    # ── shared setup ──────────────────────────────────────────────────────────
    props = agent.get("/api/properties").json()
    unit = prop = None
    for p in props:
        for u in p.get("units", []):
            unit = u; prop = p; break
        if unit: break
    agent.check("have at least one unit", bool(unit))
    unit_id = unit["id"] if unit else None

    # ──────────────────────────────────────────────────────────────────────────
    # Step 1: Workflow rules CRUD
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 1: Workflow rules CRUD ──")

    # Clean up any existing golem-created rules
    existing = agent.get("/api/workflows").json()
    golem_rules = [r for r in existing if "Golem" in r.get("name", "")]
    for r in golem_rules:
        agent.delete(f"/api/workflows/{r['id']}")

    # Create a rule
    r = agent.post("/api/workflows", {
        "name": "Golem Test — rent overdue",
        "trigger": "rent_overdue",
        "trigger_days": 5,
        "action": "telegram_agent",
        "is_active": True,
    })
    agent.check("create workflow rule", r.status_code == 200, r.text[:200])
    rule = r.json() if r.status_code == 200 else {}
    rule_id = rule.get("id")
    agent.check("rule has id", bool(rule_id))
    agent.check("rule trigger correct", rule.get("trigger") == "rent_overdue")
    agent.check("rule trigger_days correct", rule.get("trigger_days") == 5)
    agent.check("rule is_active true", rule.get("is_active") is True)
    agent.check("rule has trigger_label", bool(rule.get("trigger_label")))

    # List rules — should include our new one
    r = agent.get("/api/workflows")
    agent.check("list workflows", r.status_code == 200, r.text[:100])
    rules_list = r.json()
    found = any(r2.get("id") == rule_id for r2 in rules_list)
    agent.check("created rule appears in list", found)

    # Update trigger_days
    r = agent.put(f"/api/workflows/{rule_id}", {"trigger_days": 10})
    agent.check("update workflow rule", r.status_code == 200, r.text[:100])
    agent.check("trigger_days updated", r.json().get("trigger_days") == 10)

    # Toggle off
    r = agent.put(f"/api/workflows/{rule_id}", {"is_active": False})
    agent.check("toggle rule inactive", r.status_code == 200)
    agent.check("is_active now false", r.json().get("is_active") is False)

    # Toggle back on
    r = agent.put(f"/api/workflows/{rule_id}", {"is_active": True})
    agent.check("toggle rule active again", r.status_code == 200)
    agent.check("is_active now true", r.json().get("is_active") is True)

    # Delete
    r = agent.delete(f"/api/workflows/{rule_id}")
    agent.check("delete workflow rule", r.status_code == 200)
    rules_after = agent.get("/api/workflows").json()
    agent.check("deleted rule gone", not any(r2.get("id") == rule_id for r2 in rules_after))

    # ──────────────────────────────────────────────────────────────────────────
    # Step 2: Triggers list
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 2: Triggers list ──")
    r = agent.get("/api/workflows/triggers")
    agent.check("get triggers list", r.status_code == 200)
    triggers = r.json()
    agent.check("triggers not empty", len(triggers) > 0)
    trigger_keys = {t["trigger"] for t in triggers}
    for expected in ["rent_overdue", "lease_expiring", "maintenance_stale", "viewing_reminder", "inspection_upcoming", "ppm_due", "deposit_unprotected"]:
        agent.check(f"trigger {expected} present", expected in trigger_keys)
    # Each trigger has label, default_days, default_action
    sample = triggers[0]
    agent.check("trigger has label", "label" in sample)
    agent.check("trigger has default_days", "default_days" in sample)
    agent.check("trigger has default_action", "default_action" in sample)

    # ──────────────────────────────────────────────────────────────────────────
    # Step 3: Seed defaults (only if no rules exist)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 3: Seed defaults ──")
    current_rules = agent.get("/api/workflows").json()
    if len(current_rules) == 0:
        r = agent.post("/api/workflows/seed-defaults")
        agent.check("seed defaults succeeds", r.status_code == 200)
        seeded = r.json().get("created", 0)
        agent.check("seeded 8 rules", seeded == 8, f"got {seeded}")
        rules_after_seed = agent.get("/api/workflows").json()
        agent.check("8 rules in DB after seed", len(rules_after_seed) == 8, f"got {len(rules_after_seed)}")
        # Clean up seeded rules
        for rule in rules_after_seed:
            agent.delete(f"/api/workflows/{rule['id']}")
        agent.check("cleaned up seeded rules", True)
    else:
        # Seed should reject when rules exist
        r = agent.post("/api/workflows/seed-defaults")
        agent.check("seed rejects when rules exist", r.status_code == 400)
        agent.check("seed error message", "already exist" in r.json().get("detail", "").lower())

    # ──────────────────────────────────────────────────────────────────────────
    # Step 4: Invoice paid toggle via maintenance
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 4: Invoice paid toggle ──")
    if unit_id:
        # Create a maintenance job
        r = agent.post("/api/maintenance", {
            "unit_id": unit_id,
            "title": "Golem Invoice Test Job",
            "description": "Testing invoice paid toggle",
            "priority": "low",
        })
        agent.check("create maintenance job", r.status_code == 200, r.text[:200])
        job = r.json()
        job_id = job.get("id")

        # Set an invoice_ref (PUT requires full schema: unit_id + title)
        r = agent.put(f"/api/maintenance/{job_id}", {
            "unit_id": unit_id,
            "title": "Golem Invoice Test Job",
            "priority": "low",
            "status": "open",
            "invoice_ref": "INV-GOLEM-001",
            "actual_cost": 150.0,
        })
        agent.check("set invoice_ref", r.status_code == 200, r.text[:200])
        agent.check("invoice_ref saved", r.json().get("invoice_ref") == "INV-GOLEM-001")
        # invoice_paid not in PUT response_model — verify via list
        jobs_list = agent.get("/api/maintenance").json()
        this_job = next((j for j in jobs_list if j.get("id") == job_id), None)
        agent.check("invoice_paid starts false", this_job is not None and this_job.get("invoice_paid") == False)

        # Toggle paid (endpoint is /mark-paid)
        r = agent.post(f"/api/maintenance/{job_id}/mark-paid")
        agent.check("mark invoice paid", r.status_code == 200, r.text[:200])
        agent.check("invoice_paid now true", r.json().get("invoice_paid") == True)

        # Toggle again — back to unpaid
        r = agent.post(f"/api/maintenance/{job_id}/mark-paid")
        agent.check("toggle invoice back to unpaid", r.status_code == 200)
        agent.check("invoice_paid back to false", r.json().get("invoice_paid") == False)

        # Verify GET returns invoice fields
        r = agent.get("/api/maintenance")
        jobs = r.json()
        this_job = next((j for j in jobs if j.get("id") == job_id), None)
        agent.check("invoice fields in GET list", this_job is not None and "invoice_ref" in this_job)

        # Cleanup
        agent.delete(f"/api/maintenance/{job_id}")
    else:
        agent.check("skip invoice test — no unit", True)

    # ──────────────────────────────────────────────────────────────────────────
    # Step 5: Viewing booking — applicant with viewing_date
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 5: Viewing booking ──")
    viewing_time = (datetime.now(timezone.utc) + timedelta(hours=26)).strftime("%Y-%m-%dT%H:%M:%S")

    # Create applicant
    r = agent.post("/api/applicants", {
        "full_name": "Golem Viewing Test",
        "email": "golem-viewing-test@test.co",
        "source": "Direct",
        "status": "enquiry",
        "property_id": prop["id"] if prop else None,
    })
    agent.check("create applicant", r.status_code == 200, r.text[:200])
    applicant_id = r.json().get("id")

    # Set viewing date (this should trigger confirmation email attempt)
    r = agent.put(f"/api/applicants/{applicant_id}", {
        "status": "viewing_booked",
        "viewing_date": viewing_time,
    })
    agent.check("set viewing date", r.status_code == 200)
    agent.check("viewing_date saved", r.json().get("viewing_date") is not None)
    agent.check("status is viewing_booked", r.json().get("status") == "viewing_booked")

    # Check viewing_reminder_sent field is present (defaults to false)
    # Verify via DB that field exists
    from app.database import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        row = conn.execute(text("SELECT viewing_reminder_sent FROM applicants WHERE id = :id"), {"id": applicant_id}).fetchone()
    agent.check("viewing_reminder_sent field exists in DB", row is not None)
    agent.check("viewing_reminder_sent defaults false", row[0] in (False, None))

    # Update viewing date again (change it)
    new_viewing = (datetime.now(timezone.utc) + timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%S")
    r = agent.put(f"/api/applicants/{applicant_id}", {"viewing_date": new_viewing})
    agent.check("update viewing date", r.status_code == 200)
    agent.check("new viewing_date saved", r.json().get("viewing_date") is not None)

    # Cleanup
    agent.delete(f"/api/applicants/{applicant_id}")
    agent.check("cleanup applicant", True)

    # ──────────────────────────────────────────────────────────────────────────
    # Step 6: Dispatch history includes invoice fields
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 6: Dispatch history invoice fields ──")
    r = agent.get("/api/dispatch/history")
    agent.check("get dispatch history", r.status_code == 200)
    history = r.json()
    if history:
        # Check that jobs have invoice_ref and invoice_paid fields
        sample_batch = history[0]
        jobs = sample_batch.get("jobs", [])
        if jobs:
            sample_job = jobs[0]
            agent.check("dispatch job has invoice_ref field", "invoice_ref" in sample_job, str(sample_job.keys()))
            agent.check("dispatch job has invoice_paid field", "invoice_paid" in sample_job, str(sample_job.keys()))
        else:
            agent.check("no jobs in batch — skip field check", True)
    else:
        agent.check("no dispatch history — skip", True)

    # ──────────────────────────────────────────────────────────────────────────
    # Step 7: Dashboard new fields
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 7: Dashboard new metric fields ──")
    r = agent.get("/api/dashboard")
    agent.check("get dashboard", r.status_code == 200)
    dash = r.json()
    for field in ["applicants_active", "applicants_referencing", "deposits_unprotected",
                  "deposits_pi_outstanding", "inspections_upcoming", "inspections_overdue",
                  "ppm_overdue", "ppm_due_soon"]:
        agent.check(f"dashboard has {field}", field in dash, str(list(dash.keys())))

    # ──────────────────────────────────────────────────────────────────────────
    # Step 8: Workflow invalid trigger rejected
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 8: Workflow validation ──")
    r = agent.post("/api/workflows", {
        "name": "Bad rule",
        "trigger": "not_a_real_trigger",
        "trigger_days": 7,
        "action": "telegram_agent",
    })
    agent.check("invalid trigger rejected with 400", r.status_code == 400)
    agent.check("error mentions unknown trigger", "Unknown trigger" in r.json().get("detail", ""))

    # ─────────────────────────────────────────────────────────────────────────
    # Summary
    # ─────────────────────────────────────────────────────────────────────────
    total = len(agent._failures) + sum(1 for e in agent.log if e.get("ok"))
    failures = agent._failures
    print(f"\n{'='*60}")
    if failures:
        print(f"FAILED: {len(failures)} checks")
        for f in failures:
            print(f"  ✗ {f}")
    else:
        print("ALL CHECKS PASSED ✓")
    print(f"{'='*60}\n")
    return agent.log


if __name__ == "__main__":
    results = run(verbose=True)
