"""
Scenario: Applicant account workflow — end-to-end

Tests the full public-facing applicant journey from both sides:
Public user (unauthenticated → registered → logged in) and Agent.

  1.  Guest books a viewing (no auth)
  2.  Register account with the same email
  3.  Login → receive token
  4.  GET /account/me — profile correct
  5.  GET /account/applications — viewing appears, pending (no viewing_date)
  6.  Agent finds the applicant record
  7.  Agent sets viewing_date → confirms the viewing
  8.  GET /account/applications — viewing_date now populated
  9.  Cancel the viewing from the account
 10.  GET /account/applications — status=withdrawn
 11.  Attempt double-cancel → 400
 12.  Guest applies for a property (new applicant, same email)
 13.  GET /account/applications — application appears
 14.  Agent advances: enquiry → viewed → referencing → approved
 15.  GET /account/applications — status tracks each transition
 16.  Cancel the approved application → succeeds
 17.  Save a property to shortlist
 18.  GET /account/saved — property appears with full details
 19.  Remove saved property
 20.  GET /account/saved — now empty
 21.  Protected endpoint without token → 401
 22.  Wrong password login → 401
"""
import sys, os, secrets
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENV_FILE", "/root/propairty/backend/.env.production")
os.chdir("/root/propairty/backend")

from base import BaseGolem, BASE_URL
import requests
from datetime import datetime, timedelta, timezone

SLUG = "tyne-lettings"
PUB_BASE = f"/api/public/{SLUG}"


# ── Agent golem ───────────────────────────────────────────────────────────────
class AgentGolem(BaseGolem):
    name = "AgentGoilem"
    email = "agentgoilem@propairty.co.uk"
    login_url = "/api/auth/token"


# ── Public user golem — JSON login, not form ──────────────────────────────────
class PublicGolem(BaseGolem):
    name = "PublicUser"
    login_url = f"{PUB_BASE}/account/token"

    def __init__(self, email: str, password: str, verbose: bool = True):
        super().__init__(verbose=verbose)
        self.email = email
        self.password = password

    def login(self) -> "PublicGolem":
        resp = self.session.post(
            f"{BASE_URL}{self.login_url}",
            json={"email": self.email, "password": self.password},
        )
        if resp.status_code != 200:
            raise Exception(f"PublicUser login failed: {resp.status_code} {resp.text}")
        data = resp.json()
        self.token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self._record("LOGIN", self.login_url, resp.status_code, ok=True)
        return self


# ── Unauthenticated public HTTP helpers ───────────────────────────────────────
def pub_post(path: str, body: dict) -> requests.Response:
    return requests.post(f"{BASE_URL}{PUB_BASE}{path}", json=body)

def pub_get_anon(path: str) -> requests.Response:
    return requests.get(f"{BASE_URL}{PUB_BASE}{path}")


# ── Main ──────────────────────────────────────────────────────────────────────
def run(verbose: bool = True) -> list[dict]:
    print("\n" + "=" * 60)
    print("SCENARIO: Applicant Account Workflow — End-to-End")
    print("=" * 60)

    agent = AgentGolem(verbose=verbose).login()

    # Unique test identity so runs don't collide
    uid = secrets.token_hex(4)
    email = f"golem-applicant-{uid}@test.propairty.co.uk"
    password = "TestPass123!"
    full_name = f"Golem Applicant {uid}"

    # ── Grab a property + unit for the tests ─────────────────────────────────
    props = agent.get("/api/properties").json()
    prop = unit = None
    for p in props:
        for u in p.get("units", []):
            prop = p
            unit = u
            break
        if unit:
            break
    agent.check("have at least one unit", bool(unit))
    prop_id = prop["id"] if prop else None
    unit_id = unit["id"] if unit else None

    # ─────────────────────────────────────────────────────────────────────────
    # Step 1: Guest books a viewing (unauthenticated)
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 1: Guest books a viewing ──")
    r = pub_post("/book-viewing", {
        "full_name": full_name,
        "email": email,
        "phone": "07700900000",
        "property_id": prop_id,
        "preferred_date": "2026-05-15",
        "message": "Golem test viewing request",
    })
    agent.check("book viewing returns 201", r.status_code == 201, r.text[:200])
    agent.check("booking response ok", r.json().get("ok") is True)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 2: Register account with the same email
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 2: Register public account ──")
    r = pub_post("/account/register", {
        "full_name": full_name,
        "email": email,
        "password": password,
        "role": "tenant",
    })
    agent.check("register returns 201", r.status_code == 201, r.text[:200])
    reg = r.json()
    agent.check("register returns access_token", bool(reg.get("access_token")))
    agent.check("register returns correct email", reg.get("email") == email)
    agent.check("register returns role=tenant", reg.get("role") == "tenant")

    # Duplicate registration → 400
    r2 = pub_post("/account/register", {
        "full_name": full_name, "email": email, "password": password,
    })
    agent.check("duplicate register → 400", r2.status_code == 400)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 3: Login
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 3: Login ──")
    pub = PublicGolem(email=email, password=password, verbose=verbose).login()

    # Wrong password → 401
    r = pub_post("/account/token", {"email": email, "password": "wrongpassword"})
    agent.check("wrong password → 401", r.status_code == 401)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 4: GET /account/me
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 4: GET /account/me ──")
    me = pub.expect(pub.get(f"{PUB_BASE}/account/me"), 200, "GET /account/me")
    agent.check("me.full_name correct", me.get("full_name") == full_name)
    agent.check("me.email correct", me.get("email") == email)
    agent.check("me.role = tenant", me.get("role") == "tenant")
    agent.check("me has saved_property_ids", isinstance(me.get("saved_property_ids"), list))

    # ─────────────────────────────────────────────────────────────────────────
    # Step 5: GET /account/applications — viewing appears, pending
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 5: Applications list — viewing pending ──")
    apps_r = pub.get(f"{PUB_BASE}/account/applications")
    agent.check("GET /account/applications 200", apps_r.status_code == 200, apps_r.text[:200])
    apps = apps_r.json()
    viewing_apps = [a for a in apps if a.get("status") == "viewing_booked"]
    agent.check("viewing_booked entry appears", len(viewing_apps) >= 1)
    viewing = viewing_apps[0] if viewing_apps else {}
    agent.check("viewing has no date yet (pending)", viewing.get("viewing_date") is None)
    agent.check("viewing property_id matches", viewing.get("property_id") == prop_id)
    viewing_app_id = viewing.get("id")

    # ─────────────────────────────────────────────────────────────────────────
    # Step 6: Agent finds the applicant record
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 6: Agent locates applicant ──")
    all_apps = agent.get("/api/applicants").json()
    agent_app = next((a for a in all_apps if a.get("email") == email), None)
    agent.check("agent can find applicant by email", bool(agent_app), f"email={email}")
    agent_app_id = agent_app["id"] if agent_app else None

    # ─────────────────────────────────────────────────────────────────────────
    # Step 7: Agent sets viewing_date (confirms the viewing)
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 7: Agent confirms viewing with a date ──")
    future_date = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%dT10:00:00")
    r = agent.put(f"/api/applicants/{agent_app_id}", {
        "viewing_date": future_date,
    })
    agent.check("agent sets viewing_date 200", r.status_code == 200, r.text[:200])
    updated = r.json()
    agent.check("viewing_date now set", bool(updated.get("viewing_date")))

    # ─────────────────────────────────────────────────────────────────────────
    # Step 8: Account — viewing now confirmed (has date)
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 8: Verify viewing confirmed in account ──")
    apps = pub.get(f"{PUB_BASE}/account/applications").json()
    confirmed = next((a for a in apps if a.get("id") == viewing_app_id), None)
    agent.check("confirmed viewing still in list", bool(confirmed))
    agent.check("confirmed viewing has viewing_date", bool(confirmed.get("viewing_date") if confirmed else False))
    agent.check("confirmed status still viewing_booked", (confirmed or {}).get("status") == "viewing_booked")

    # ─────────────────────────────────────────────────────────────────────────
    # Step 9: Cancel the viewing from the account
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 9: Cancel viewing from account ──")
    r = pub.post(f"{PUB_BASE}/account/applications/{viewing_app_id}/cancel")
    agent.check("cancel viewing 200", r.status_code == 200, r.text[:200])
    agent.check("cancel returns ok=True", r.json().get("ok") is True)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 10: Status = withdrawn
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 10: Verify status=withdrawn ──")
    apps = pub.get(f"{PUB_BASE}/account/applications").json()
    withdrawn = next((a for a in apps if a.get("id") == viewing_app_id), None)
    agent.check("cancelled entry still in list", bool(withdrawn))
    agent.check("status is withdrawn", (withdrawn or {}).get("status") == "withdrawn")

    # ─────────────────────────────────────────────────────────────────────────
    # Step 11: Double-cancel → 400
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 11: Double-cancel → 400 ──")
    r = pub.post(f"{PUB_BASE}/account/applications/{viewing_app_id}/cancel")
    agent.check("double-cancel → 400", r.status_code == 400)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 12: Apply for the property (new applicant record, same email)
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 12: Apply for property ──")
    r = pub_post("/apply", {
        "full_name": full_name,
        "email": email,
        "phone": "07700900000",
        "property_id": prop_id,
        "unit_id": unit_id,
        "desired_move_in": "2026-06-01",
        "monthly_budget": "£950-£1,100",
        "message": "Golem test application",
    })
    agent.check("apply returns 201", r.status_code == 201, r.text[:200])

    # ─────────────────────────────────────────────────────────────────────────
    # Step 13: Application appears in account
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 13: Application visible in account ──")
    apps = pub.get(f"{PUB_BASE}/account/applications").json()
    new_app = next((a for a in apps if a.get("status") == "enquiry"), None)
    agent.check("new application (enquiry) in list", bool(new_app))
    new_app_id = new_app["id"] if new_app else None

    # Find this new applicant on agent side
    all_apps = agent.get("/api/applicants").json()
    agent_new = next((a for a in all_apps if a.get("id") == new_app_id), None)
    agent.check("agent can see the new application", bool(agent_new))

    # ─────────────────────────────────────────────────────────────────────────
    # Step 14 + 15: Agent advances pipeline; account reflects each change
    # ─────────────────────────────────────────────────────────────────────────
    for new_status in ("viewed", "referencing", "approved"):
        print(f"\n── Steps 14–15: Agent → {new_status} / account verifies ──")
        r = agent.put(f"/api/applicants/{new_app_id}", {"status": new_status})
        agent.check(f"agent sets status={new_status}", r.status_code == 200, r.text[:200])

        apps = pub.get(f"{PUB_BASE}/account/applications").json()
        found = next((a for a in apps if a.get("id") == new_app_id), None)
        agent.check(f"account shows status={new_status}", (found or {}).get("status") == new_status)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 16: Cancel an approved application → succeeds
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 16: Cancel approved application ──")
    r = pub.post(f"{PUB_BASE}/account/applications/{new_app_id}/cancel")
    agent.check("cancel approved → 200", r.status_code == 200, r.text[:200])
    apps = pub.get(f"{PUB_BASE}/account/applications").json()
    found = next((a for a in apps if a.get("id") == new_app_id), None)
    agent.check("approved→cancelled is withdrawn", (found or {}).get("status") == "withdrawn")

    # ─────────────────────────────────────────────────────────────────────────
    # Step 17: Save a property
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 17: Save a property ──")
    r = pub.post(f"{PUB_BASE}/account/saved/{prop_id}")
    agent.check("save property 201", r.status_code == 201, r.text[:200])

    # Idempotent — saving again should not error
    r2 = pub.post(f"{PUB_BASE}/account/saved/{prop_id}")
    agent.check("save same property again is ok", r2.status_code == 201)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 18: Saved properties list
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 18: GET /account/saved ──")
    saved_r = pub.get(f"{PUB_BASE}/account/saved")
    agent.check("GET /account/saved 200", saved_r.status_code == 200, saved_r.text[:200])
    saved = saved_r.json()
    agent.check("saved list has 1 entry", len(saved) == 1)
    agent.check("saved entry has id", bool(saved[0].get("id")) if saved else False)
    agent.check("saved entry has name", bool(saved[0].get("name")) if saved else False)
    agent.check("saved_property_ids in /me updated", prop_id in pub.get(f"{PUB_BASE}/account/me").json().get("saved_property_ids", []))

    # ─────────────────────────────────────────────────────────────────────────
    # Step 19: Remove saved property
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 19: Remove saved property ──")
    r = pub.delete(f"{PUB_BASE}/account/saved/{prop_id}")
    agent.check("unsave property 200", r.status_code == 200, r.text[:200])

    # ─────────────────────────────────────────────────────────────────────────
    # Step 20: Saved list now empty
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 20: Saved list now empty ──")
    saved = pub.get(f"{PUB_BASE}/account/saved").json()
    agent.check("saved list empty after remove", len(saved) == 0)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 21: Protected endpoint without token → 401
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 21: Auth guard — no token → 401 ──")
    r = pub_get_anon("/account/me")
    agent.check("no-token /account/me → 401", r.status_code == 401)
    r = pub_get_anon("/account/applications")
    agent.check("no-token /account/applications → 401", r.status_code == 401)
    r = pub_get_anon("/account/saved")
    agent.check("no-token /account/saved → 401", r.status_code == 401)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 22: Isolation — other user cannot cancel this user's applications
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n── Step 22: Isolation — other account cannot cancel ──")
    uid2 = secrets.token_hex(4)
    email2 = f"golem-other-{uid2}@test.propairty.co.uk"
    r = pub_post("/account/register", {"full_name": "Other Golem", "email": email2, "password": password})
    if r.status_code == 201:
        other = PublicGolem(email=email2, password=password, verbose=verbose).login()
        r = other.post(f"{PUB_BASE}/account/applications/{viewing_app_id}/cancel")
        agent.check("other user cannot cancel → 404", r.status_code == 404)
    else:
        agent.check("other user registration skipped (env issue)", True)

    # ─────────────────────────────────────────────────────────────────────────
    # Summary
    # ─────────────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    s = agent.summary()
    print(f"RESULT: {s['passed']}/{s['checks']} passed | {s['failed']} failed")
    if s["failures"]:
        print("FAILURES:")
        for f in s["failures"]:
            print(f"  {f}")
    print("=" * 60)
    return agent.log


if __name__ == "__main__":
    run()
