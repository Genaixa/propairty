"""
LLM Messaging Chaos Golem
=========================
Focused chaos test for all messaging channels:
  Agent ↔ Tenant
  Agent ↔ Contractor
  Agent ↔ Landlord

Runs all 4 roles simultaneously (sequentially per-turn) to simulate
real back-and-forth conversation, verifying messages flow both ways.

Usage:
    python llm_golem_messaging.py --turns 15
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
    GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
    groq_client = Groq(api_key=GROQ_KEY)
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False
    print("[messaging_golem] groq not installed — run: pip install groq")


# ── Action registries ─────────────────────────────────────────────────────────

AGENT_ACTIONS = {
    "read_tenant_inbox":      ("Read all tenant message threads (inbox)", []),
    "read_contractor_inbox":  ("Read all contractor message threads (inbox)", []),
    "read_landlord_inbox":    ("Read all landlord message threads (inbox)", []),
    "msg_tenant":             ("Send a message to the golem tenant", ["body"]),
    "msg_contractor":         ("Send a message to the golem contractor", ["body"]),
    "msg_landlord":           ("Send a message to the golem landlord", ["body"]),
    "read_tenant_thread":     ("Read the message thread with the golem tenant", []),
    "read_contractor_thread": ("Read the message thread with the golem contractor", []),
    "read_landlord_thread":   ("Read the message thread with the golem landlord", []),
    "msg_bad_tenant":         ("Try sending a message to a non-existent tenant id", ["body"]),
    "msg_empty_body":         ("Try sending a message with an empty body to tenant", []),
}

TENANT_ACTIONS = {
    "read_messages":   ("Read all messages from agent", []),
    "send_message":    ("Send a message to the agent", ["body"]),
    "check_unread":    ("Check unread message count", []),
    "send_blank":      ("Try sending a blank message", []),
    "send_long":       ("Send an unusually long message", []),
    "send_duplicate":  ("Send the same message twice in a row", ["body"]),
}

CONTRACTOR_ACTIONS = {
    "read_messages":   ("Read all messages from agent", []),
    "send_message":    ("Send a message to the agent", ["body"]),
    "check_unread":    ("Check unread message count", []),
    "send_blank":      ("Try sending a blank message", []),
    "send_long":       ("Send an unusually long message", []),
    "send_duplicate":  ("Send the same message twice in a row", ["body"]),
}

LANDLORD_ACTIONS = {
    "read_messages":   ("Read all messages from agent", []),
    "send_message":    ("Send a message to the agent", ["body"]),
    "check_unread":    ("Check unread message count", []),
    "send_blank":      ("Try sending a blank message", []),
    "send_long":       ("Send an unusually long message", []),
    "send_duplicate":  ("Send the same message twice in a row", ["body"]),
}


# ── LLM decision ──────────────────────────────────────────────────────────────

def ask_llm(role: str, actions: dict, state: dict, history: list) -> dict:
    action_list = "\n".join(
        f"  {k}: {v[0]} (params: {v[1] or 'none'})"
        for k, v in actions.items()
    )
    history_str = "\n".join(
        f"  [{i+1}] {h['action']} → {h['result']}"
        for i, h in enumerate(history[-6:])
    )
    state_str = json.dumps(state, indent=2)[:1500]

    prompt = f"""You are a real {role} user testing the messaging system of a UK property management platform called PropAIrty.
Your goal: probe the messaging system thoroughly — send messages, check they arrive, test edge cases.

Current state:
{state_str}

Recent actions:
{history_str if history else '  (none yet)'}

Available actions:
{action_list}

Choose the SINGLE most interesting next action. Prefer:
- Verifying messages sent by OTHER parties have arrived
- Trying unusual content (emoji, special chars, very long, blank)
- Checking unread counts before and after reading
- Sending to non-existent entities
- Rapid duplicate sends

Respond with ONLY a JSON object:
{{
  "action": "<action_key>",
  "params": {{"body": "message text if needed"}},
  "reasoning": "<one sentence why>"
}}

Use realistic UK landlord/tenant/agent language. Keep messages believable.
"""
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
        max_tokens=250,
    )
    text = response.choices[0].message.content.strip()
    try:
        start = text.find("{"); end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except Exception:
        print(f"  [llm] parse error: {text}")
        return {"action": list(actions.keys())[0], "params": {}, "reasoning": "fallback"}


# ── Action execution ──────────────────────────────────────────────────────────

def execute(golem: BaseGolem, role: str, action: str, params: dict, state: dict) -> str:
    try:
        # ── Agent ──────────────────────────────────────────────────────────────
        if role == "agent":
            tenant_id    = state.get("tenant_id")
            contractor_id = state.get("contractor_id")
            landlord_id  = state.get("landlord_id")

            if action == "read_tenant_inbox":
                r = golem.get("/api/tenants/messages/inbox")
                threads = r.json() if r.ok else []
                state["agent_tenant_threads"] = len(threads) if isinstance(threads, list) else 0
                return f"{r.status_code} — {state['agent_tenant_threads']} tenant thread(s)"

            elif action == "read_contractor_inbox":
                r = golem.get("/api/contractors/messages/inbox")
                threads = r.json() if r.ok else []
                state["agent_contractor_threads"] = len(threads) if isinstance(threads, list) else 0
                return f"{r.status_code} — {state['agent_contractor_threads']} contractor thread(s)"

            elif action == "read_landlord_inbox":
                r = golem.get("/api/landlord/messages/inbox")
                threads = r.json() if r.ok else []
                state["agent_landlord_threads"] = len(threads) if isinstance(threads, list) else 0
                return f"{r.status_code} — {state['agent_landlord_threads']} landlord thread(s)"

            elif action == "msg_tenant":
                if not tenant_id:
                    return "no tenant_id in state"
                body = params.get("body", "Hi, just checking in about your tenancy.")
                r = golem.post(f"/api/tenants/{tenant_id}/messages", {"body": body})
                state.setdefault("agent_sent_to_tenant", []).append(body[:40])
                return f"{r.status_code} — sent to tenant: '{body[:40]}'"

            elif action == "msg_contractor":
                if not contractor_id:
                    return "no contractor_id in state"
                body = params.get("body", "Could you confirm your availability for next week?")
                r = golem.post(f"/api/contractors/{contractor_id}/messages", {"body": body})
                state.setdefault("agent_sent_to_contractor", []).append(body[:40])
                return f"{r.status_code} — sent to contractor: '{body[:40]}'"

            elif action == "msg_landlord":
                if not landlord_id:
                    return "no landlord_id in state"
                body = params.get("body", "Monthly statement ready for your review.")
                r = golem.post(f"/api/landlord/messages/{landlord_id}", {"body": body})
                state.setdefault("agent_sent_to_landlord", []).append(body[:40])
                return f"{r.status_code} — sent to landlord: '{body[:40]}'"

            elif action == "read_tenant_thread":
                if not tenant_id:
                    return "no tenant_id in state"
                r = golem.get(f"/api/tenants/{tenant_id}/messages")
                msgs = r.json() if r.ok else []
                state["agent_tenant_msg_count"] = len(msgs) if isinstance(msgs, list) else 0
                return f"{r.status_code} — {state['agent_tenant_msg_count']} messages in thread"

            elif action == "read_contractor_thread":
                if not contractor_id:
                    return "no contractor_id in state"
                r = golem.get(f"/api/contractors/{contractor_id}/messages")
                msgs = r.json() if r.ok else []
                state["agent_contractor_msg_count"] = len(msgs) if isinstance(msgs, list) else 0
                return f"{r.status_code} — {state['agent_contractor_msg_count']} messages in thread"

            elif action == "read_landlord_thread":
                if not landlord_id:
                    return "no landlord_id in state"
                r = golem.get(f"/api/landlord/messages/{landlord_id}")
                msgs = r.json() if r.ok else []
                state["agent_landlord_msg_count"] = len(msgs) if isinstance(msgs, list) else 0
                return f"{r.status_code} — {state['agent_landlord_msg_count']} messages in thread"

            elif action == "msg_bad_tenant":
                body = params.get("body", "This should 404")
                r = golem.post("/api/tenants/99999/messages", {"body": body})
                return f"{r.status_code} (expected 404) — '{r.text[:60]}'"

            elif action == "msg_empty_body":
                if not tenant_id:
                    return "no tenant_id in state"
                r = golem.post(f"/api/tenants/{tenant_id}/messages", {"body": ""})
                return f"{r.status_code} (expected 4xx for empty body) — '{r.text[:60]}'"

        # ── Tenant ─────────────────────────────────────────────────────────────
        elif role == "tenant":
            if action == "read_messages":
                r = golem.get("/api/tenant/portal/messages")
                msgs = r.json() if r.ok else []
                count = len(msgs) if isinstance(msgs, list) else 0
                state["tenant_msg_count"] = count
                # check agent messages arrived
                agent_msgs = [m for m in (msgs if isinstance(msgs, list) else []) if m.get("sender_type") == "agent"]
                state["tenant_agent_msgs"] = len(agent_msgs)
                return f"{r.status_code} — {count} total, {len(agent_msgs)} from agent"

            elif action == "send_message":
                body = params.get("body", "Any update on my maintenance request please?")
                r = golem.post("/api/tenant/portal/messages", {"body": body})
                state.setdefault("tenant_sent", []).append(body[:40])
                return f"{r.status_code} — sent: '{body[:40]}'"

            elif action == "check_unread":
                r = golem.get("/api/tenant/portal/messages/unread-count")
                data = r.json() if r.ok else {}
                state["tenant_unread"] = data.get("count", "?")
                return f"{r.status_code} — unread={state['tenant_unread']}"

            elif action == "send_blank":
                r = golem.post("/api/tenant/portal/messages", {"body": ""})
                return f"{r.status_code} (expected 4xx for blank) — '{r.text[:60]}'"

            elif action == "send_long":
                body = "I have a very serious concern about the property. " * 40
                r = golem.post("/api/tenant/portal/messages", {"body": body})
                return f"{r.status_code} — sent {len(body)}-char message"

            elif action == "send_duplicate":
                body = params.get("body", "Is anyone there? Hello?")
                r1 = golem.post("/api/tenant/portal/messages", {"body": body})
                r2 = golem.post("/api/tenant/portal/messages", {"body": body})
                return f"first={r1.status_code} second={r2.status_code} — duplicate send"

        # ── Contractor ─────────────────────────────────────────────────────────
        elif role == "contractor":
            if action == "read_messages":
                r = golem.get("/api/contractor/messages")
                msgs = r.json() if r.ok else []
                count = len(msgs) if isinstance(msgs, list) else 0
                state["contractor_msg_count"] = count
                agent_msgs = [m for m in (msgs if isinstance(msgs, list) else []) if m.get("sender_type") == "agent"]
                state["contractor_agent_msgs"] = len(agent_msgs)
                return f"{r.status_code} — {count} total, {len(agent_msgs)} from agent"

            elif action == "send_message":
                body = params.get("body", "On my way — should arrive by 10am.")
                r = golem.post("/api/contractor/messages", {"body": body})
                state.setdefault("contractor_sent", []).append(body[:40])
                return f"{r.status_code} — sent: '{body[:40]}'"

            elif action == "check_unread":
                r = golem.get("/api/contractor/messages/unread-count")
                data = r.json() if r.ok else {}
                state["contractor_unread"] = data.get("count", "?")
                return f"{r.status_code} — unread={state['contractor_unread']}"

            elif action == "send_blank":
                r = golem.post("/api/contractor/messages", {"body": ""})
                return f"{r.status_code} (expected 4xx for blank) — '{r.text[:60]}'"

            elif action == "send_long":
                body = "Just to let you know, the job took longer than expected due to parts availability. " * 20
                r = golem.post("/api/contractor/messages", {"body": body})
                return f"{r.status_code} — sent {len(body)}-char message"

            elif action == "send_duplicate":
                body = params.get("body", "Parts ordered, ETA 3 days.")
                r1 = golem.post("/api/contractor/messages", {"body": body})
                r2 = golem.post("/api/contractor/messages", {"body": body})
                return f"first={r1.status_code} second={r2.status_code} — duplicate send"

        # ── Landlord ───────────────────────────────────────────────────────────
        elif role == "landlord":
            if action == "read_messages":
                r = golem.get("/api/landlord/portal/messages")
                msgs = r.json() if r.ok else []
                count = len(msgs) if isinstance(msgs, list) else 0
                state["landlord_msg_count"] = count
                agent_msgs = [m for m in (msgs if isinstance(msgs, list) else []) if m.get("sender_type") == "agent"]
                state["landlord_agent_msgs"] = len(agent_msgs)
                return f"{r.status_code} — {count} total, {len(agent_msgs)} from agent"

            elif action == "send_message":
                body = params.get("body", "Please keep me updated on the boiler situation at Riverside House.")
                r = golem.post("/api/landlord/portal/messages", {"body": body})
                state.setdefault("landlord_sent", []).append(body[:40])
                return f"{r.status_code} — sent: '{body[:40]}'"

            elif action == "check_unread":
                r = golem.get("/api/landlord/portal/messages/unread-count")
                data = r.json() if r.ok else {}
                state["landlord_unread"] = data.get("count", "?")
                return f"{r.status_code} — unread={state['landlord_unread']}"

            elif action == "send_blank":
                r = golem.post("/api/landlord/portal/messages", {"body": ""})
                return f"{r.status_code} (expected 4xx for blank) — '{r.text[:60]}'"

            elif action == "send_long":
                body = "I am very concerned about the state of the property and would like a full written report. " * 20
                r = golem.post("/api/landlord/portal/messages", {"body": body})
                return f"{r.status_code} — sent {len(body)}-char message"

            elif action == "send_duplicate":
                body = params.get("body", "Have you received my previous message?")
                r1 = golem.post("/api/landlord/portal/messages", {"body": body})
                r2 = golem.post("/api/landlord/portal/messages", {"body": body})
                return f"first={r1.status_code} second={r2.status_code} — duplicate send"

        return "action not implemented"
    except Exception as e:
        return f"ERROR: {e}"


# ── Bootstrap: resolve golem entity IDs via the agent ────────────────────────

def resolve_golem_ids(agent: AgentGolem) -> dict:
    """Find the tenant/contractor/landlord golem IDs by querying as agent."""
    ids = {}

    tenants = agent.get("/api/tenants").json()
    t = next((x for x in (tenants if isinstance(tenants, list) else [])
               if x.get("email") == "tenantgoilem@propairty.co.uk"), None)
    ids["tenant_id"] = t["id"] if t else None

    contractors = agent.get("/api/contractors").json()
    c = next((x for x in (contractors if isinstance(contractors, list) else [])
               if x.get("email") == "contractorgoilem@propairty.co.uk"), None)
    ids["contractor_id"] = c["id"] if c else None

    landlords = agent.get("/api/landlords").json()
    l = next((x for x in (landlords if isinstance(landlords, list) else [])
               if x.get("email") == "landlordgoilem@propairty.co.uk"), None)
    ids["landlord_id"] = l["id"] if l else None

    return ids


# ── Main runner ───────────────────────────────────────────────────────────────

def run_messaging_chaos(turns: int = 15):
    if not LLM_AVAILABLE:
        print("Groq not available — run: pip install groq")
        return

    print("\n" + "=" * 60)
    print(f"MESSAGING CHAOS — ALL PARTIES ({turns} turns each)")
    print("=" * 60)

    agent      = AgentGolem(verbose=False).login()
    tenant     = TenantGolem(verbose=False).login()
    contractor = ContractorGolem(verbose=False).login()
    landlord   = LandlordGolem(verbose=False).login()
    print("✓ All 4 golems logged in\n")

    # Resolve entity IDs
    ids = resolve_golem_ids(agent)
    print(f"Golem IDs: tenant={ids['tenant_id']} contractor={ids['contractor_id']} landlord={ids['landlord_id']}")

    roles = [
        ("agent",      agent,      AGENT_ACTIONS,      {**ids}),
        ("tenant",     tenant,     TENANT_ACTIONS,      {}),
        ("contractor", contractor, CONTRACTOR_ACTIONS,  {}),
        ("landlord",   landlord,   LANDLORD_ACTIONS,    {}),
    ]

    histories = {r[0]: [] for r in roles}
    all_results = []

    for turn in range(1, turns + 1):
        print(f"\n{'─'*60}")
        print(f"TURN {turn}/{turns}")
        print('─' * 60)

        for role, golem, actions, state in roles:
            decision = ask_llm(role, actions, state, histories[role])
            action   = decision.get("action", "")
            params   = decision.get("params", {})
            reasoning = decision.get("reasoning", "")

            if action not in actions:
                print(f"  [{role}] skip unknown action: {action}")
                continue

            result = execute(golem, role, action, params, state)
            status = "✓" if "ERROR" not in result and "500" not in result else "✗"

            print(f"  {status} [{role:10s}] {action} → {result}")
            if "ERROR" in result or "500" in result:
                print(f"    ⚠  reasoning: {reasoning}")

            histories[role].append({"action": action, "params": params, "result": result})
            all_results.append({"role": role, "action": action, "result": result, "ok": status == "✓"})
            time.sleep(0.3)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("RESULTS SUMMARY")
    print('=' * 60)

    errors   = [r for r in all_results if not r["ok"]]
    edge_cases = [r for r in all_results if any(x in r["result"] for x in ["4", "404", "400", "422"])]

    print(f"Total actions : {len(all_results)}")
    print(f"Errors (5xx)  : {len(errors)}")
    print(f"Edge cases hit: {len(edge_cases)}")

    if errors:
        print("\n⚠  ERRORS:")
        for e in errors:
            print(f"  [{e['role']}] {e['action']} → {e['result']}")

    print("\nEdge cases explored:")
    for e in edge_cases:
        print(f"  [{e['role']}] {e['action']} → {e['result']}")

    print(f"\n{'✓ PASS' if not errors else '✗ FAIL'} — {len(all_results) - len(errors)}/{len(all_results)} actions succeeded")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--turns", type=int, default=15)
    args = parser.parse_args()
    run_messaging_chaos(turns=args.turns)
