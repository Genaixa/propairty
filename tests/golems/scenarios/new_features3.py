"""
Scenario: Public user accounts, save/unsave, book-viewing, apply + confirmation email wiring.

  1.  Registration — happy path
  2.  Duplicate email — must reject
  3.  Weak password — must reject
  4.  Login — correct credentials
  5.  Login — wrong password → 401
  6.  /me — no token → 401
  7.  /me — bad token → 401
  8.  /me — valid token returns correct data
  9.  Save property — happy path
  10. Save same property twice — idempotent
  11. /me reflects saved property
  12. GET /account/saved — returns full property data
  13. Unsave — removes from list
  14. Cross-org save guard — can't save under wrong slug
  15. Book viewing — creates applicant with status=viewing_booked
  16. Book viewing — missing required field → 422
  17. Apply — creates applicant with status=enquiry
  18. Apply — pre-fills move_in date correctly
  19. Enquiry endpoint (legacy) — still works
  20. Cleanup
"""
import sys, os, uuid, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENV_FILE", "/root/propairty/backend/.env.production")
os.chdir("/root/propairty/backend")

import requests
from base import BASE_URL, BaseGolem, GOLEM_PASSWORD


# ── Unauthenticated public client ─────────────────────────────────────────────
class PublicClient:
    """Thin wrapper for unauthenticated public API calls."""
    def __init__(self, slug: str):
        self.slug = slug
        self.session = requests.Session()
        self.session.headers["Content-Type"] = "application/json"
        self.token: str | None = None

    def _url(self, path: str) -> str:
        return f"{BASE_URL}/api/public/{self.slug}{path}"

    def _auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def post(self, path, json=None, token=None):
        h = {"Authorization": f"Bearer {token}"} if token else {}
        return self.session.post(self._url(path), json=json, headers=h)

    def get(self, path, token=None):
        h = {"Authorization": f"Bearer {token}"} if token else {}
        return self.session.get(self._url(path), headers=h)

    def delete(self, path, token=None):
        h = {"Authorization": f"Bearer {token}"} if token else {}
        return self.session.delete(self._url(path), headers=h)


# ── Agent golem (to verify applicants were created) ───────────────────────────
class AgentGolem(BaseGolem):
    name = "AgentGoilem"
    email = "agentgoilem@propairty.co.uk"
    login_url = "/api/auth/token"


def run(verbose: bool = True) -> list[dict]:
    print("\n" + "="*60)
    print("SCENARIO: Public accounts, save/apply — Sprint 3")
    print("="*60)

    # ── Bootstrap ────────────────────────────────────────────────────────────
    agent = AgentGolem(verbose=verbose).login()

    # Get org slug
    org_resp = agent.get("/api/organisations/me")
    org = org_resp.json() if org_resp.status_code == 200 else {}
    slug = None
    if org.get("website_url"):
        parts = org["website_url"].rstrip("/").split("/")
        if parts and parts[-1]:
            slug = parts[-1]
    if not slug:
        # Fall back: try to infer from a known public endpoint
        r = requests.get(f"{BASE_URL}/api/public/portal-info")
        if r.status_code == 200:
            # try tyne-lettings as fallback
            slug = "tyne-lettings"
    agent.check("have org slug", bool(slug), f"org={org}")

    # Get a property to use for saves/viewings
    props_r = requests.get(f"{BASE_URL}/api/public/{slug}/properties")
    props = props_r.json() if props_r.status_code == 200 else []
    agent.check("public properties endpoint works", props_r.status_code == 200)
    agent.check("at least one property exists", len(props) > 0)
    prop_id = props[0]["id"] if props else None

    pub = PublicClient(slug)
    uid = uuid.uuid4().hex[:8]
    email = f"golem_{uid}@test-golem.co.uk"
    password = "GolemPass99!"
    full_name = f"Golem User {uid}"

    # ──────────────────────────────────────────────────────────────────────────
    # Step 1: Registration — happy path
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 1: Registration ──")
    r = pub.post("/account/register", {"full_name": full_name, "email": email, "phone": "07700900001", "password": password})
    agent.check("register returns 201", r.status_code == 201, r.text[:200])
    reg_data = r.json() if r.status_code == 201 else {}
    token = reg_data.get("access_token")
    agent.check("register returns access_token", bool(token))
    agent.check("register returns full_name", reg_data.get("full_name") == full_name)
    agent.check("register returns email (lowercase)", reg_data.get("email") == email.lower())

    # ──────────────────────────────────────────────────────────────────────────
    # Step 2: Duplicate email rejected
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 2: Duplicate email ──")
    r2 = pub.post("/account/register", {"full_name": "Dupe", "email": email, "password": password})
    agent.check("duplicate email → 400", r2.status_code == 400, r2.text[:200])
    agent.check("error mentions 'exists'", "exist" in r2.text.lower(), r2.text[:200])

    # ──────────────────────────────────────────────────────────────────────────
    # Step 3: Weak password rejected
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 3: Weak password ──")
    r3 = pub.post("/account/register", {"full_name": "Weak", "email": f"weak_{uid}@test.com", "password": "abc"})
    agent.check("short password → 400", r3.status_code == 400, r3.text[:200])

    # ──────────────────────────────────────────────────────────────────────────
    # Step 4: Login correct credentials
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 4: Login ──")
    r4 = pub.post("/account/token", {"email": email, "password": password})
    agent.check("login returns 200", r4.status_code == 200, r4.text[:200])
    login_token = r4.json().get("access_token") if r4.status_code == 200 else None
    agent.check("login returns token", bool(login_token))
    agent.check("login token is a string", isinstance(login_token, str) and len(login_token) > 20)

    # Use the login token from here on (not register token) to confirm both work
    token = login_token or token

    # ──────────────────────────────────────────────────────────────────────────
    # Step 5: Wrong password → 401
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 5: Wrong password ──")
    r5 = pub.post("/account/token", {"email": email, "password": "wrongpassword"})
    agent.check("wrong password → 401", r5.status_code == 401, r5.text[:200])

    # ──────────────────────────────────────────────────────────────────────────
    # Step 6: /me without token → 401
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 6–7: Auth guards ──")
    r6 = pub.get("/account/me")
    agent.check("/me without token → 401", r6.status_code == 401, r6.text[:200])

    # ──────────────────────────────────────────────────────────────────────────
    # Step 7: /me with bad token → 401
    # ──────────────────────────────────────────────────────────────────────────
    r7 = pub.get("/account/me", token="this.is.not.a.valid.jwt")
    agent.check("/me with bad token → 401", r7.status_code == 401, r7.text[:200])

    # ──────────────────────────────────────────────────────────────────────────
    # Step 8: /me with valid token
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 8: /me ──")
    r8 = pub.get("/account/me", token=token)
    agent.check("/me returns 200", r8.status_code == 200, r8.text[:200])
    me = r8.json() if r8.status_code == 200 else {}
    agent.check("/me returns id", bool(me.get("id")))
    agent.check("/me returns correct email", me.get("email") == email.lower())
    agent.check("/me returns correct full_name", me.get("full_name") == full_name)
    agent.check("/me saved_property_ids is empty list", me.get("saved_property_ids") == [])

    if not prop_id:
        agent.check("SKIP: no property to test saves", True)
    else:
        # ──────────────────────────────────────────────────────────────────────
        # Step 9: Save property
        # ──────────────────────────────────────────────────────────────────────
        print("\n── Step 9: Save property ──")
        r9 = pub.post(f"/account/saved/{prop_id}", token=token)
        agent.check("save property → 201", r9.status_code == 201, r9.text[:200])
        agent.check("save returns ok:true", r9.json().get("ok") is True)

        # ──────────────────────────────────────────────────────────────────────
        # Step 10: Save same property twice — idempotent
        # ──────────────────────────────────────────────────────────────────────
        print("\n── Step 10: Idempotent save ──")
        r10 = pub.post(f"/account/saved/{prop_id}", token=token)
        agent.check("save same property again → 201", r10.status_code == 201, r10.text[:200])

        # ──────────────────────────────────────────────────────────────────────
        # Step 11: /me reflects saved property
        # ──────────────────────────────────────────────────────────────────────
        print("\n── Step 11: /me saved_property_ids ──")
        r11 = pub.get("/account/me", token=token)
        me2 = r11.json() if r11.status_code == 200 else {}
        agent.check("/me saved_property_ids includes saved prop", prop_id in me2.get("saved_property_ids", []))

        # ──────────────────────────────────────────────────────────────────────
        # Step 12: GET /account/saved — full property data
        # ──────────────────────────────────────────────────────────────────────
        print("\n── Step 12: GET /account/saved ──")
        r12 = pub.get("/account/saved", token=token)
        agent.check("GET /account/saved → 200", r12.status_code == 200, r12.text[:200])
        saved_list = r12.json() if r12.status_code == 200 else []
        agent.check("saved list has 1 item", len(saved_list) == 1, str(len(saved_list)))
        if saved_list:
            sp = saved_list[0]
            agent.check("saved property has id", sp.get("id") == prop_id)
            agent.check("saved property has name", bool(sp.get("name")))
            agent.check("saved property has units", isinstance(sp.get("units"), list))

        # ──────────────────────────────────────────────────────────────────────
        # Step 13: Unsave
        # ──────────────────────────────────────────────────────────────────────
        print("\n── Step 13: Unsave ──")
        r13 = pub.delete(f"/account/saved/{prop_id}", token=token)
        agent.check("unsave → 200", r13.status_code == 200, r13.text[:200])
        r13b = pub.get("/account/me", token=token)
        me3 = r13b.json() if r13b.status_code == 200 else {}
        agent.check("saved_property_ids empty after unsave", prop_id not in me3.get("saved_property_ids", [prop_id]))

        # ──────────────────────────────────────────────────────────────────────
        # Step 14: Cross-org guard
        # ──────────────────────────────────────────────────────────────────────
        print("\n── Step 14: Cross-org guard ──")
        # Try to save under a different (non-existent) slug using our token
        fake_client = PublicClient("definitely-not-a-real-slug-xyz")
        r14 = fake_client.post(f"/account/saved/{prop_id}", token=token)
        # Either 404 (org not found) or 403 (forbidden) — both are correct guards
        agent.check("cross-org save blocked", r14.status_code in (403, 404, 422), r14.text[:200])

    # ──────────────────────────────────────────────────────────────────────────
    # Step 15: Book viewing — happy path
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 15: Book viewing ──")
    viewing_payload = {
        "property_id": prop_id or 1,
        "full_name": full_name,
        "email": email,
        "phone": "07700900001",
        "preferred_date": "2026-05-10",
        "message": "Golem viewing request",
    }
    r15 = pub.post("/book-viewing", viewing_payload)
    agent.check("book viewing → 201", r15.status_code == 201, r15.text[:200])
    agent.check("book viewing ok:true", r15.json().get("ok") is True)
    agent.check("book viewing message present", bool(r15.json().get("message")))

    # Verify applicant was created in the agent's dashboard
    time.sleep(0.5)
    applicants = agent.get("/api/applicants").json() if agent.get("/api/applicants").status_code == 200 else []
    golem_applicants = [a for a in applicants if a.get("email") == email]
    viewing_applicants = [a for a in golem_applicants if a.get("status") == "viewing_booked"]
    agent.check("viewing applicant visible in dashboard", len(viewing_applicants) >= 1,
                f"found {len(golem_applicants)} total golem applicants, {len(viewing_applicants)} viewing_booked")
    if viewing_applicants:
        va = viewing_applicants[0]
        agent.check("viewing applicant has correct name", va.get("full_name") == full_name)
        agent.check("viewing applicant source=Direct", va.get("source") == "Direct")
        agent.check("viewing applicant has notes with preferred_date", "2026-05-10" in (va.get("notes") or ""))

    # ──────────────────────────────────────────────────────────────────────────
    # Step 16: Book viewing — missing required field → 422
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 16: Book viewing validation ──")
    r16 = pub.post("/book-viewing", {"property_id": prop_id or 1, "email": email})  # missing full_name
    agent.check("book viewing without full_name → 422", r16.status_code == 422, r16.text[:200])

    # ──────────────────────────────────────────────────────────────────────────
    # Step 17: Apply — happy path
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 17: Apply ──")
    apply_payload = {
        "property_id": prop_id or 1,
        "full_name": full_name,
        "email": email,
        "phone": "07700900001",
        "desired_move_in": "2026-06-01",
        "monthly_budget": "£900-£1,000",
        "message": "Golem application",
    }
    r17 = pub.post("/apply", apply_payload)
    agent.check("apply → 201", r17.status_code == 201, r17.text[:200])
    agent.check("apply ok:true", r17.json().get("ok") is True)

    # Verify in dashboard
    time.sleep(0.5)
    applicants2 = agent.get("/api/applicants").json() if agent.get("/api/applicants").status_code == 200 else []
    enquiry_applicants = [a for a in applicants2 if a.get("email") == email and a.get("status") == "enquiry"]
    agent.check("apply applicant visible in dashboard", len(enquiry_applicants) >= 1,
                f"found {len(enquiry_applicants)} enquiry applicants for {email}")
    if enquiry_applicants:
        ea = enquiry_applicants[0]
        agent.check("apply applicant budget set", ea.get("monthly_budget") == "£900-£1,000")
        agent.check("apply applicant move_in set", bool(ea.get("desired_move_in")))

    # ──────────────────────────────────────────────────────────────────────────
    # Step 18: Apply — missing required field → 422
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 18: Apply validation ──")
    r18 = pub.post("/apply", {"property_id": prop_id or 1, "full_name": full_name})  # missing email
    agent.check("apply without email → 422", r18.status_code == 422, r18.text[:200])

    # ──────────────────────────────────────────────────────────────────────────
    # Step 19: Legacy enquiry endpoint still works
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 19: Legacy enquiry ──")
    r19 = pub.post("/enquiry", {
        "full_name": full_name,
        "email": email,
        "phone": "07700900001",
        "property_id": prop_id,
        "message": "Golem legacy enquiry",
    })
    agent.check("legacy enquiry → 201", r19.status_code == 201, r19.text[:200])
    agent.check("legacy enquiry ok:true", r19.json().get("ok") is True)

    # ──────────────────────────────────────────────────────────────────────────
    # Step 20: Cleanup — delete all golem applicants created here
    # ──────────────────────────────────────────────────────────────────────────
    print("\n── Step 20: Cleanup ──")
    all_applicants = agent.get("/api/applicants").json() if agent.get("/api/applicants").status_code == 200 else []
    golem_app_ids = [a["id"] for a in all_applicants if a.get("email") == email]
    deleted = 0
    for aid in golem_app_ids:
        rd = agent.delete(f"/api/applicants/{aid}")
        if rd.status_code == 200:
            deleted += 1
    agent.check(f"cleaned up {len(golem_app_ids)} golem applicants", deleted == len(golem_app_ids),
                f"deleted {deleted}/{len(golem_app_ids)}")

    # ── Results ───────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    s = agent.summary()
    if s["failed"] == 0:
        print("ALL CHECKS PASSED ✓")
    else:
        print(f"FAILURES: {s['failed']}/{s['checks']}")
        for f in s["failures"]:
            print(f"  ✗ {f}")
    print("="*60)
    return agent.log


if __name__ == "__main__":
    run()
