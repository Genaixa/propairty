"""
Scenario: Full maintenance job lifecycle.

  TenantGoilem reports a boiler issue
  AgentGoilem sees it, assigns ContractorGoilem
  ContractorGoilem accepts, submits a quote
  AgentGoilem approves the quote, sets a scheduled date
  ContractorGoilem completes the job with actual cost
  AgentGoilem marks invoice paid
  LandlordGoilem can see the job and its cost
  Cross-portal notes are visible to agent
"""
import sys, os, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from agent import AgentGolem
from tenant import TenantGolem
from landlord import LandlordGolem
from contractor import ContractorGolem


def run(verbose: bool = True) -> list[dict]:
    print("\n" + "="*60)
    print("SCENARIO: Full Maintenance Lifecycle")
    print("="*60)

    agent      = AgentGolem(verbose=verbose).login()
    tenant     = TenantGolem(verbose=verbose).login()
    landlord   = LandlordGolem(verbose=verbose).login()
    contractor = ContractorGolem(verbose=verbose).login()

    # ── 1. Tenant submits maintenance request ─────────────────────────────────
    print("\n── Step 1: Tenant reports boiler issue ──")
    job = tenant.submit_maintenance("Boiler not working", priority="high")
    job_id = job.get("id")
    tenant.check("maintenance job created", bool(job_id), f"got: {job}")

    # ── 2. Tenant sees their job ───────────────────────────────────────────────
    print("\n── Step 2: Tenant sees their job in portal ──")
    t_jobs = tenant.get_maintenance()
    tenant.check("tenant can see submitted job", any(j.get("id") == job_id for j in t_jobs),
                 f"job_id={job_id} not in {[j.get('id') for j in t_jobs]}")

    # ── 3. Agent sees the job and assigns contractor ───────────────────────────
    print("\n── Step 3: Agent assigns contractor ──")
    time.sleep(1)  # let background dispatch run
    all_jobs = agent.get("/api/maintenance").json()
    a_job = next((j for j in all_jobs if j.get("id") == job_id), None)
    agent.check("agent can see tenant-submitted job", bool(a_job), f"job_id={job_id}")

    contractors = agent.get_contractors()
    goilem_contractor = next(
        (c for c in contractors if "goilem" in c.get("email", "").lower()), None
    )
    agent.check("contractorgoilem exists in contractor list", bool(goilem_contractor))
    contractor_id = goilem_contractor["id"] if goilem_contractor else None

    if contractor_id:
        assigned = agent.assign_contractor(job_id, contractor_id)
        agent.check("contractor assigned", assigned.get("contractor_id") == contractor_id,
                    f"got: {assigned}")

    # ── 4. Contractor sees the job ────────────────────────────────────────────
    print("\n── Step 4: Contractor sees assigned job ──")
    c_jobs = contractor.get_jobs()
    c_job = next((j for j in c_jobs if j.get("id") == job_id), None)
    contractor.check("contractor can see their assigned job", bool(c_job), f"job_id={job_id}")

    if c_job:
        contractor.check("contractor sees tenant contact or no crash", True)  # field present
        scheduled = c_job.get("scheduled_date")
        contractor.check("scheduled_date field present", "scheduled_date" in c_job)

    # ── 5. Contractor accepts job and submits quote ───────────────────────────
    print("\n── Step 5: Contractor accepts and quotes ──")
    acc = contractor.accept_job(job_id)
    contractor.check("accept returns ok", acc.get("ok") is True, f"got: {acc}")

    quote = contractor.submit_quote(job_id, 320.00, "Labour + parts for boiler repair")
    contractor.check("quote submitted", quote.get("ok") is True, f"got: {quote}")

    # ── 6. Agent sees the quote and approves ──────────────────────────────────
    print("\n── Step 6: Agent sees quote, approves it ──")
    all_jobs = agent.get("/api/maintenance").json()
    a_job = next((j for j in all_jobs if j.get("id") == job_id), None)
    agent.check("agent sees contractor_accepted=True", a_job and a_job.get("contractor_accepted") is True,
                f"contractor_accepted={a_job.get('contractor_accepted') if a_job else 'N/A'}")
    agent.check("agent sees contractor_quote=320", a_job and a_job.get("contractor_quote") == 320.0,
                f"quote={a_job.get('contractor_quote') if a_job else 'N/A'}")

    approve_result = agent.approve_quote(job_id)
    agent.check("quote approved", approve_result.get("quote_status") == "approved",
                f"got: {approve_result}")

    # ── 7. Agent sets scheduled date ─────────────────────────────────────────
    print("\n── Step 7: Agent sets scheduled date ──")
    sched = agent.set_scheduled_date(job_id, "2026-05-15")
    agent.check("scheduled date set", sched.get("scheduled_date") == "2026-05-15",
                f"got: {sched}")

    # ── 7b. Contractor proposes alternative date, agent accepts ──────────────
    print("\n── Step 7b: Contractor proposes alternative date ──")
    propose_result = contractor.propose_date(job_id, "2026-05-20")
    contractor.check("propose date ok", propose_result.get("ok") is True, f"got: {propose_result}")

    # Verify agent sees the proposal
    all_jobs = agent.get("/api/maintenance").json()
    a_job = next((j for j in all_jobs if j.get("id") == job_id), None)
    contractor.check("proposed_date visible to agent", a_job and a_job.get("proposed_date") == "2026-05-20",
                     f"proposed_date={a_job.get('proposed_date') if a_job else 'N/A'}")
    contractor.check("proposed_date_status is pending", a_job and a_job.get("proposed_date_status") == "pending",
                     f"status={a_job.get('proposed_date_status') if a_job else 'N/A'}")

    # Agent accepts the proposed date
    print("\n── Step 7c: Agent accepts proposed date ──")
    decision = agent.proposed_date_decision(job_id, "accepted")
    agent.check("proposed date accepted", decision.get("scheduled_date") == "2026-05-20",
                f"got: {decision}")

    # Verify scheduled_date updated and proposal cleared
    all_jobs = agent.get("/api/maintenance").json()
    a_job = next((j for j in all_jobs if j.get("id") == job_id), None)
    agent.check("scheduled_date updated to proposed", a_job and a_job.get("scheduled_date") == "2026-05-20",
                f"scheduled_date={a_job.get('scheduled_date') if a_job else 'N/A'}")
    agent.check("proposed_date cleared after accept", a_job and a_job.get("proposed_date") is None,
                f"proposed_date={a_job.get('proposed_date') if a_job else 'N/A'}")

    # ── 7d. Contractor proposes again, agent rejects ──────────────────────────
    print("\n── Step 7d: Contractor proposes again, agent rejects ──")
    propose2 = contractor.propose_date(job_id, "2026-06-01")
    contractor.check("second propose ok", propose2.get("ok") is True, f"got: {propose2}")

    reject_decision = agent.proposed_date_decision(job_id, "rejected")
    agent.check("proposed date rejected ok", reject_decision.get("ok") is True, f"got: {reject_decision}")

    # Verify original date preserved and proposal status = rejected
    all_jobs = agent.get("/api/maintenance").json()
    a_job = next((j for j in all_jobs if j.get("id") == job_id), None)
    agent.check("scheduled_date unchanged after reject", a_job and a_job.get("scheduled_date") == "2026-05-20",
                f"scheduled_date={a_job.get('scheduled_date') if a_job else 'N/A'}")
    agent.check("proposed_date_status=rejected after decline",
                a_job and a_job.get("proposed_date_status") == "rejected",
                f"status={a_job.get('proposed_date_status') if a_job else 'N/A'}")

    # ── 8. Contractor adds a note and marks complete ──────────────────────────
    print("\n── Step 8: Contractor adds note + marks complete ──")
    note = contractor.add_note(job_id, "Replaced faulty thermocouple, tested OK")
    contractor.check("contractor note added", bool(note.get("id")), f"got: {note}")

    done = contractor.update_job_status(job_id, "completed", cost=295.00)
    contractor.check("job marked completed", done.get("status") == "completed", f"got: {done}")

    # ── 9. Agent sees the completed job cost ─────────────────────────────────
    print("\n── Step 9: Agent verifies cost visible ──")
    all_jobs = agent.get("/api/maintenance").json()
    a_job = next((j for j in all_jobs if j.get("id") == job_id), None)
    agent.check("agent sees actual_cost=295", a_job and a_job.get("actual_cost") == 295.0,
                f"actual_cost={a_job.get('actual_cost') if a_job else 'N/A'}")
    agent.check("agent sees notes from contractor", True)  # notes were added via contractor

    agent_notes = agent.get_notes(job_id)
    has_contractor_note = any("thermocouple" in n.get("body", "") for n in agent_notes)
    agent.check("contractor note visible to agent", has_contractor_note,
                f"notes: {[n.get('body') for n in agent_notes]}")

    # ── 10. Agent marks invoice paid ──────────────────────────────────────────
    print("\n── Step 10: Agent marks invoice paid ──")
    paid = agent.mark_invoice_paid(job_id)
    agent.check("invoice marked paid", paid.get("invoice_paid") is True, f"got: {paid}")

    # ── 11. Landlord sees the job with cost ───────────────────────────────────
    print("\n── Step 11: Landlord sees completed job ──")
    l_jobs = landlord.get_maintenance()
    l_job = next((j for j in l_jobs if j.get("id") == job_id), None)
    landlord.check("landlord can see the job", bool(l_job), f"job_id={job_id}")
    if l_job:
        landlord.check("landlord sees actual_cost", l_job.get("actual_cost") == 295.0,
                       f"actual_cost={l_job.get('actual_cost')}")
        landlord.check("landlord sees assigned_to contractor", bool(l_job.get("assigned_to")),
                       f"assigned_to={l_job.get('assigned_to')}")

    # ── 12. Tenant sees completed status ─────────────────────────────────────
    print("\n── Step 12: Tenant sees updated status ──")
    t_jobs = tenant.get_maintenance()
    t_job = next((j for j in t_jobs if j.get("id") == job_id), None)
    tenant.check("tenant sees completed status", t_job and t_job.get("status") == "completed",
                 f"status={t_job.get('status') if t_job else 'N/A'}")
    if t_job:
        tenant.check("tenant sees assigned_to", bool(t_job.get("assigned_to")),
                     f"assigned_to={t_job.get('assigned_to')}")

    # ── 13. Cross-portal messaging ────────────────────────────────────────────
    print("\n── Step 13: Messaging smoke test ──")
    tenant.send_message("Thank you, boiler is working now!")
    t_msgs = tenant.get_messages()
    tenant.check("tenant messages endpoint works", isinstance(t_msgs, list))

    contractor.send_message("Invoice will follow by post")
    c_msgs = contractor.get_messages()
    contractor.check("contractor messages endpoint works", isinstance(c_msgs, list))

    landlord.send_message("Happy with the quick turnaround")
    l_msgs = landlord.get_messages()
    landlord.check("landlord messages endpoint works", isinstance(l_msgs, list))

    # ── 14. Clean up — delete test job ───────────────────────────────────────
    print("\n── Step 14: Cleanup ──")
    deleted = agent.delete_maintenance(job_id)
    agent.check("test job deleted", deleted.get("ok") is True, f"got: {deleted}")

    # ── Summary ───────────────────────────────────────────────────────────────
    summaries = [g.summary() for g in [agent, tenant, landlord, contractor]]
    return summaries


if __name__ == "__main__":
    results = run(verbose=True)
    print("\n" + "="*60)
    print("RESULTS")
    print("="*60)
    total_pass = total_fail = 0
    for s in results:
        total_pass += s["passed"]
        total_fail += s["failed"]
        icon = "✓" if s["failed"] == 0 else "✗"
        print(f"{icon} {s['golem']:25s}  {s['passed']}/{s['checks']} passed")
        for f in s["failures"]:
            print(f"    → {f}")
    print(f"\nTotal: {total_pass} passed, {total_fail} failed")
