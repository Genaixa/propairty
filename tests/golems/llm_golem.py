"""
LLM-Driven Chaos Golem
======================
Uses Groq (llama-3.3-70b) to decide what actions to take as each portal user.
The LLM receives the current system state and picks from an action menu —
it won't follow a script, so it finds unexpected edge cases.

Usage:
    python llm_golem.py --role agent --turns 10
    python llm_golem.py --role tenant --turns 5
    python llm_golem.py --role contractor --turns 8
    python llm_golem.py --all --turns 6
"""
import sys, os, json, argparse, time, random
sys.path.insert(0, os.path.dirname(__file__))

from base import BaseGolem, GOLEM_PASSWORD
from agent import AgentGolem
from tenant import TenantGolem
from landlord import LandlordGolem
from contractor import ContractorGolem

try:
    from groq import Groq
    GROQ_KEY = os.environ.get("GROQ_API_KEY", "GROQ_API_KEY_REMOVED")
    groq_client = Groq(api_key=GROQ_KEY)
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False
    print("[llm_golem] groq package not installed — run: pip install groq")


# ── Action registry per role ──────────────────────────────────────────────────

AGENT_ACTIONS = {
    "list_jobs":          ("List all maintenance jobs", []),
    "list_contractors":   ("List all contractors", []),
    "create_job":         ("Create a maintenance job", ["unit_id", "title", "priority"]),
    "assign_contractor":  ("Assign contractor to a job", ["job_id", "contractor_id"]),
    "approve_quote":      ("Approve a contractor quote", ["job_id"]),
    "reject_quote":       ("Reject a contractor quote", ["job_id"]),
    "set_scheduled_date":       ("Set a scheduled date on a job", ["job_id", "date"]),
    "accept_proposed_date":     ("Accept contractor's proposed reschedule date", ["job_id"]),
    "reject_proposed_date":     ("Reject contractor's proposed reschedule date", ["job_id"]),
    "mark_paid":                ("Mark invoice paid on a job", ["job_id"]),
    "add_note":           ("Add a note to a job", ["job_id", "note"]),
    "send_contractor_msg":("Send a message to contractor", ["contractor_id", "body"]),
    "get_dashboard":      ("View dashboard", []),
}

TENANT_ACTIONS = {
    "submit_maintenance": ("Report a maintenance issue", ["title", "priority"]),
    "view_jobs":          ("View my maintenance jobs", []),
    "view_messages":      ("Read messages from agent", []),
    "send_message":       ("Send a message to agent", ["body"]),
    "view_documents":     ("View my documents", []),
}

CONTRACTOR_ACTIONS = {
    "view_jobs":     ("View my assigned jobs", []),
    "accept_job":    ("Accept a job", ["job_id"]),
    "decline_job":   ("Decline a job", ["job_id"]),
    "submit_quote":  ("Submit a quote for a job", ["job_id", "amount", "notes"]),
    "complete_job":  ("Mark a job as completed", ["job_id", "actual_cost"]),
    "propose_date":  ("Propose an alternative scheduled date", ["job_id", "date"]),
    "add_note":      ("Add a note to a job", ["job_id", "note"]),
    "view_messages": ("View messages from agent", []),
    "send_message":  ("Send a message to agent", ["body"]),
    "update_profile":("Update my profile / trade info", ["trade", "notes"]),
}

LANDLORD_ACTIONS = {
    "view_maintenance": ("View property maintenance jobs", []),
    "view_messages":    ("Read messages from agent", []),
    "send_message":     ("Send a message to agent", ["body"]),
    "view_notices":     ("View legal notices", []),
    "view_documents":   ("View documents", []),
}


ROLE_MAP = {
    "agent":      (AgentGolem,      AGENT_ACTIONS),
    "tenant":     (TenantGolem,     TENANT_ACTIONS),
    "contractor": (ContractorGolem, CONTRACTOR_ACTIONS),
    "landlord":   (LandlordGolem,   LANDLORD_ACTIONS),
}


def ask_llm(role: str, actions: dict, state: dict, history: list) -> dict:
    """Ask the LLM to pick the next action and provide parameters."""
    action_list = "\n".join(
        f"  {k}: {v[0]} (params: {v[1] or 'none'})"
        for k, v in actions.items()
    )
    history_str = "\n".join(
        f"  [{i+1}] {h['action']} → {h['result']}"
        for i, h in enumerate(history[-5:])  # last 5 actions
    )
    state_str = json.dumps(state, indent=2)[:2000]

    prompt = f"""You are a real {role} user testing a UK property management platform called PropAIrty.
Your goal: explore the system naturally, try things in unexpected orders, find edge cases.

Current system state:
{state_str}

Recent actions taken:
{history_str if history else '  (none yet)'}

Available actions:
{action_list}

Choose the SINGLE most interesting next action to take. Prefer:
- Actions that interact with data created by other users
- Unusual sequences (e.g., approve a quote before accepting, submit maintenance late at night)
- Exploring what happens at boundaries

Respond with ONLY a JSON object:
{{
  "action": "<action_key>",
  "params": {{"param1": "value1"}},
  "reasoning": "<one sentence why>"
}}

Use realistic UK values (dates as YYYY-MM-DD, amounts in GBP, names that sound British).
If a required param like job_id isn't in state, pick any plausible value or use null to skip.
"""
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8,
        max_tokens=300,
    )
    text = response.choices[0].message.content.strip()
    # Parse JSON
    try:
        # Find JSON block
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except Exception:
        print(f"  [llm] parse error: {text}")
        return {"action": list(actions.keys())[0], "params": {}, "reasoning": "fallback"}


def execute_action(golem: BaseGolem, role: str, action: str, params: dict, state: dict) -> str:
    """Execute the chosen action and return a short result string."""
    try:
        if role == "agent":
            if action == "list_jobs":
                jobs = golem.get("/api/maintenance").json()
                state["agent_jobs"] = [{"id": j["id"], "title": j["title"], "status": j["status"],
                                         "contractor_id": j.get("contractor_id"),
                                         "quote_status": j.get("quote_status"),
                                         "contractor_quote": j.get("contractor_quote"),
                                         "scheduled_date": j.get("scheduled_date"),
                                         "proposed_date": j.get("proposed_date"),
                                         "proposed_date_status": j.get("proposed_date_status")} for j in jobs[:10]]
                return f"fetched {len(jobs)} jobs"
            elif action == "list_contractors":
                contractors = golem.get("/api/contractors").json()
                state["contractors"] = [{"id": c["id"], "name": c.get("company_name") or c.get("full_name")} for c in contractors[:5]]
                return f"fetched {len(contractors)} contractors"
            elif action == "create_job":
                unit_id = params.get("unit_id", state.get("first_unit_id", 1))
                title = params.get("title", f"Test issue {random.randint(100,999)}")
                priority = params.get("priority", "medium")
                job = golem.post("/api/maintenance", {"unit_id": unit_id, "title": title,
                                                       "description": "[LLM CHAOS TEST]",
                                                       "priority": priority}).json()
                if job.get("id"):
                    state.setdefault("chaos_jobs", []).append(job["id"])
                return f"created job id={job.get('id')}"
            elif action == "assign_contractor":
                job_id = params.get("job_id") or (state.get("agent_jobs") or [{}])[0].get("id")
                c_id = params.get("contractor_id") or (state.get("contractors") or [{}])[0].get("id")
                if job_id and c_id:
                    jobs = golem.get("/api/maintenance").json()
                    job = next((j for j in jobs if j["id"] == job_id), None)
                    if job:
                        r = golem.put(f"/api/maintenance/{job_id}", {
                            "unit_id": job["unit_id"], "title": job["title"],
                            "description": job.get("description",""), "priority": job["priority"],
                            "status": job["status"], "contractor_id": c_id})
                        return f"assigned contractor {c_id} to job {job_id}: {r.status_code}"
                return "skipped (missing job_id or contractor_id)"
            elif action == "approve_quote":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("agent_jobs", []) if j.get("quote_status") == "pending"), None)
                if job_id:
                    r = golem.post(f"/api/maintenance/{job_id}/quote-decision", {"decision": "approved"})
                    return f"quote approved: {r.status_code}"
                return "no pending quotes found"
            elif action == "reject_quote":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("agent_jobs", []) if j.get("quote_status") == "pending"), None)
                if job_id:
                    r = golem.post(f"/api/maintenance/{job_id}/quote-decision", {"decision": "rejected"})
                    return f"quote rejected: {r.status_code}"
                return "no pending quotes"
            elif action == "set_scheduled_date":
                job_id = params.get("job_id") or (state.get("chaos_jobs") or [None])[0]
                date = params.get("date", "2026-06-01")
                if job_id:
                    r = golem.post(f"/api/maintenance/{job_id}/scheduled-date", {"scheduled_date": date})
                    return f"scheduled {date}: {r.status_code}"
                return "no job_id"
            elif action == "accept_proposed_date":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("agent_jobs", []) if j.get("proposed_date_status") == "pending"), None)
                if job_id:
                    r = golem.post(f"/api/maintenance/{job_id}/proposed-date-decision", {"decision": "accepted"})
                    return f"accepted proposed date on {job_id}: {r.status_code} {r.text[:80]}"
                return "no jobs with pending proposed date"
            elif action == "reject_proposed_date":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("agent_jobs", []) if j.get("proposed_date_status") == "pending"), None)
                if job_id:
                    r = golem.post(f"/api/maintenance/{job_id}/proposed-date-decision", {"decision": "rejected"})
                    return f"rejected proposed date on {job_id}: {r.status_code} {r.text[:80]}"
                return "no jobs with pending proposed date"
            elif action == "mark_paid":
                job_id = params.get("job_id") or (state.get("chaos_jobs") or [None])[0]
                if job_id:
                    r = golem.post(f"/api/maintenance/{job_id}/mark-paid")
                    return f"marked paid: {r.status_code}"
                return "no job_id"
            elif action == "add_note":
                job_id = params.get("job_id") or (state.get("chaos_jobs") or [None])[0]
                note = params.get("note", "LLM chaos note")
                if job_id:
                    r = golem.post(f"/api/maintenance/{job_id}/notes", {"body": note})
                    return f"note added: {r.status_code}"
                return "no job_id"
            elif action == "send_contractor_msg":
                c_id = params.get("contractor_id") or (state.get("contractors") or [{}])[0].get("id")
                body = params.get("body", "Please confirm your availability for this week.")
                if c_id:
                    r = golem.post(f"/api/contractors/{c_id}/messages", {"body": body})
                    return f"msg sent to contractor {c_id}: {r.status_code} — '{body[:40]}'"
                return "no contractor_id in state — run list_contractors first"
            elif action == "get_dashboard":
                r = golem.get("/api/dashboard")
                return f"dashboard: {r.status_code}"

        elif role == "tenant":
            if action == "submit_maintenance":
                title = params.get("title", f"Issue {random.randint(100,999)}")
                priority = params.get("priority", "medium")
                r = golem.post("/api/tenant/portal/maintenance", {
                    "title": title, "description": "[LLM CHAOS TEST]", "priority": priority})
                job = r.json()
                if job.get("id"):
                    state.setdefault("tenant_jobs", []).append(job["id"])
                return f"submitted job id={job.get('id')}: {r.status_code}"
            elif action == "view_jobs":
                jobs = golem.get("/api/tenant/portal/maintenance").json()
                state["tenant_jobs"] = [j["id"] for j in (jobs if isinstance(jobs, list) else [])]
                return f"fetched {len(jobs) if isinstance(jobs,list) else 0} jobs"
            elif action == "view_messages":
                r = golem.get("/api/tenant/portal/messages")
                return f"messages: {r.status_code}, count={len(r.json()) if r.ok else 'err'}"
            elif action == "send_message":
                body = params.get("body", "Hello, any update on my request?")
                r = golem.post("/api/tenant/portal/messages", {"body": body})
                return f"sent message: {r.status_code}"
            elif action == "view_documents":
                r = golem.get("/api/tenant/portal/documents")
                return f"documents: {r.status_code}"

        elif role == "contractor":
            if action == "view_jobs":
                jobs = golem.get("/api/contractor/jobs").json()
                state["contractor_jobs"] = [{"id": j["id"], "status": j["status"],
                                              "contractor_accepted": j.get("contractor_accepted"),
                                              "quote_status": j.get("quote_status"),
                                              "scheduled_date": j.get("scheduled_date"),
                                              "proposed_date": j.get("proposed_date"),
                                              "proposed_date_status": j.get("proposed_date_status")} for j in (jobs if isinstance(jobs, list) else [])]
                return f"fetched {len(state['contractor_jobs'])} jobs"
            elif action == "accept_job":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("contractor_jobs", []) if j.get("contractor_accepted") is None), None)
                if job_id:
                    r = golem.post(f"/api/contractor/jobs/{job_id}/accept")
                    return f"accepted job {job_id}: {r.status_code}"
                return "no unaccepted jobs"
            elif action == "decline_job":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("contractor_jobs", []) if j.get("contractor_accepted") is None), None)
                if job_id:
                    r = golem.post(f"/api/contractor/jobs/{job_id}/decline")
                    return f"declined job {job_id}: {r.status_code}"
                return "no unaccepted jobs"
            elif action == "submit_quote":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("contractor_jobs", []) if j.get("contractor_accepted") is True), None)
                amount = float(params.get("amount", random.randint(100, 800)))
                notes = params.get("notes", "Labour and materials")
                if job_id:
                    r = golem.post(f"/api/contractor/jobs/{job_id}/quote", {"amount": amount, "notes": notes})
                    return f"submitted quote £{amount} for job {job_id}: {r.status_code}"
                return "no accepted jobs to quote on"
            elif action == "complete_job":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("contractor_jobs", []) if j.get("status") == "in_progress"), None)
                cost = float(params.get("actual_cost", random.randint(100, 600)))
                if job_id:
                    r = golem.put(f"/api/contractor/jobs/{job_id}", {"status": "completed", "actual_cost": cost})
                    return f"completed job {job_id} cost=£{cost}: {r.status_code}"
                return "no in_progress jobs"
            elif action == "propose_date":
                job_id = params.get("job_id") or next(
                    (j["id"] for j in state.get("contractor_jobs", []) if j.get("scheduled_date")), None) \
                    or (state.get("contractor_jobs") or [{}])[0].get("id")
                date = params.get("date", f"2026-{random.randint(6,9):02d}-{random.randint(1,28):02d}")
                if job_id:
                    r = golem.post(f"/api/contractor/jobs/{job_id}/propose-date", {"proposed_date": date})
                    return f"proposed {date} for job {job_id}: {r.status_code} {r.text[:80]}"
                return "no jobs to propose date for"
            elif action == "add_note":
                job_id = params.get("job_id") or (state.get("contractor_jobs") or [{}])[0].get("id")
                note = params.get("note", "Work in progress")
                if job_id:
                    r = golem.post(f"/api/contractor/jobs/{job_id}/notes", {"body": note})
                    return f"note added {job_id}: {r.status_code}"
                return "no jobs"
            elif action == "view_messages":
                r = golem.get("/api/contractor/messages")
                return f"messages: {r.status_code}"
            elif action == "send_message":
                body = params.get("body", "On my way to site, ETA 2pm")
                r = golem.post("/api/contractor/messages", {"body": body})
                return f"sent: {r.status_code}"
            elif action == "update_profile":
                r = golem.put("/api/contractor/profile", {
                    "full_name": "Contractor Goilem", "phone": "07700000003",
                    "email": golem.email, "company_name": "Goilem Trades Ltd",
                    "trade": params.get("trade", "Plumbing & Heating"),
                    "notes": params.get("notes", "Gas Safe registered, OFTEC certified")})
                return f"profile updated: {r.status_code}"

        elif role == "landlord":
            if action == "view_maintenance":
                r = golem.get("/api/landlord/portal/maintenance")
                jobs = r.json() if r.ok else []
                state["landlord_jobs"] = [{"id": j["id"], "status": j["status"]} for j in (jobs if isinstance(jobs,list) else [])]
                return f"fetched {len(state['landlord_jobs'])} jobs"
            elif action == "view_messages":
                r = golem.get("/api/landlord/portal/messages")
                return f"messages: {r.status_code}"
            elif action == "send_message":
                body = params.get("body", "Please keep me updated on the boiler situation")
                r = golem.post("/api/landlord/portal/messages", {"body": body})
                return f"sent: {r.status_code}"
            elif action == "view_notices":
                r = golem.get("/api/landlord/portal/notices")
                return f"notices: {r.status_code}"
            elif action == "view_documents":
                r = golem.get("/api/landlord/portal/documents")
                return f"documents: {r.status_code}"

        return "action not implemented"
    except Exception as e:
        return f"ERROR: {e}"


def run_chaos(role: str, turns: int = 8, verbose: bool = True) -> dict:
    if not LLM_AVAILABLE:
        print("Groq not available — run: pip install groq")
        return {}

    GolemClass, actions = ROLE_MAP[role]
    golem = GolemClass(verbose=False).login()
    print(f"\n{'='*60}")
    print(f"LLM CHAOS GOLEM: {role.upper()} ({turns} turns)")
    print(f"{'='*60}")

    # Seed initial state
    state: dict = {"role": role}
    if role == "agent":
        # Get first unit id
        props = golem.get("/api/properties").json()
        if props and isinstance(props, list) and props[0].get("units"):
            state["first_unit_id"] = props[0]["units"][0]["id"]

    history = []

    for turn in range(1, turns + 1):
        print(f"\n── Turn {turn}/{turns} ──")
        decision = ask_llm(role, actions, state, history)
        action = decision.get("action", "")
        params = decision.get("params", {})
        reasoning = decision.get("reasoning", "")

        print(f"  LLM chose: {action}")
        print(f"  Reasoning: {reasoning}")

        if action not in actions:
            print(f"  [skip] unknown action: {action}")
            continue

        result = execute_action(golem, role, action, params, state)
        print(f"  Result: {result}")

        history.append({"action": action, "params": params, "result": result})
        time.sleep(0.5)  # be polite to the API

    print(f"\n── {role} chaos complete: {turns} turns ──")
    return {"role": role, "turns": turns, "history": history}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LLM Chaos Golem")
    parser.add_argument("--role", choices=["agent", "tenant", "contractor", "landlord"], default="agent")
    parser.add_argument("--all", action="store_true", help="Run all 4 roles")
    parser.add_argument("--turns", type=int, default=8)
    args = parser.parse_args()

    if args.all:
        for role in ["agent", "tenant", "contractor", "landlord"]:
            run_chaos(role, turns=args.turns)
    else:
        run_chaos(args.role, turns=args.turns)
