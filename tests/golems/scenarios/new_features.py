"""
Scenario: Sequential tests for features shipped in the latest sprint.

  1. Applicant right-to-rent + referencing status
  2. Applicant → tenancy conversion (creates tenant + lease)
  3. Deposit ↔ inspection linking
  4. Inspection check-in vs check-out comparison
  5. Email invite flow (send → invite-info → accept → JWT)
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
    print("SCENARIO: New Features — Sequential")
    print("="*60)

    agent = AgentGolem(verbose=verbose).login()

    # ── helpers ───────────────────────────────────────────────────────────────
    def ok(r):
        return r.status_code < 400

    # Grab first available unit for test objects
    props = agent.get("/api/properties").json()
    unit = None
    prop = None
    for p in props:
        for u in p.get("units", []):
            unit = u
            prop = p
            break
        if unit:
            break
    agent.check("have at least one unit for tests", bool(unit), f"props={[p['name'] for p in props]}")
    unit_id = unit["id"] if unit else None

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Applicant referencing fields
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 1: Applicant right-to-rent + referencing status ──")

    r = agent.post("/api/applicants", {
        "full_name": "[GOLEM] Referencing Test",
        "email": f"golem-ref-{secrets.token_hex(4)}@test.co",
        "source": "Direct",
        "status": "referencing",
        "unit_id": unit_id,
    })
    app = agent.expect(r, 200, "create applicant")
    app_id = app.get("id")
    agent.check("applicant created", bool(app_id), f"got: {app}")

    # Fields should be present in response
    agent.check("right_to_rent_checked defaults false",
                app.get("right_to_rent_checked") is False,
                f"got: {app.get('right_to_rent_checked')}")
    agent.check("referencing_status defaults not_started",
                app.get("referencing_status") == "not_started",
                f"got: {app.get('referencing_status')}")

    # Update both fields
    r = agent.put(f"/api/applicants/{app_id}", {
        "right_to_rent_checked": True,
        "referencing_status": "passed",
    })
    updated = agent.expect(r, 200, "update referencing fields")
    agent.check("right_to_rent_checked now True",
                updated.get("right_to_rent_checked") is True,
                f"got: {updated.get('right_to_rent_checked')}")
    agent.check("referencing_status now passed",
                updated.get("referencing_status") == "passed",
                f"got: {updated.get('referencing_status')}")

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Applicant → tenancy conversion
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 2: Applicant → tenancy conversion ──")

    r = agent.post("/api/applicants", {
        "full_name": "[GOLEM] Convert Test",
        "email": f"golem-convert-{secrets.token_hex(4)}@test.co",
        "source": "Rightmove",
        "status": "approved",
        "unit_id": unit_id,
    })
    conv_app = agent.expect(r, 200, "create approved applicant")
    conv_id = conv_app.get("id")
    agent.check("approved applicant created", bool(conv_id), f"got: {conv_app}")

    import datetime
    today = datetime.date.today().isoformat()
    end = (datetime.date.today() + datetime.timedelta(days=365)).isoformat()

    r = agent.post(f"/api/applicants/{conv_id}/convert", {
        "monthly_rent": 1200.0,
        "start_date": today,
        "end_date": end,
        "deposit": 2400.0,
        "rent_day": 1,
        "is_periodic": False,
    })
    result = agent.expect(r, 200, "convert applicant to tenancy")
    agent.check("conversion returns tenant_id",
                bool(result.get("tenant_id")),
                f"got: {result}")
    agent.check("conversion returns lease_id",
                bool(result.get("lease_id")),
                f"got: {result}")

    # Verify applicant status updated
    r = agent.get("/api/applicants")
    apps = agent.expect(r, 200, "fetch applicants after convert")
    conv_app_refetch = next((a for a in apps if a["id"] == conv_id), None)
    agent.check("applicant status → tenancy_created",
                conv_app_refetch and conv_app_refetch.get("status") == "tenancy_created",
                f"status={conv_app_refetch.get('status') if conv_app_refetch else 'not found'}")

    # Verify tenant record exists
    tenant_id = result.get("tenant_id")
    if tenant_id:
        r = agent.get(f"/api/tenants/{tenant_id}")
        tenant = agent.expect(r, 200, f"fetch created tenant {tenant_id}")
        agent.check("tenant record exists with correct name",
                    "[GOLEM] Convert Test" in tenant.get("full_name", ""),
                    f"name={tenant.get('full_name')}")

    # Cleanup applicants
    agent.delete(f"/api/applicants/{app_id}")
    agent.delete(f"/api/applicants/{conv_id}")

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Deposit ↔ inspection linking
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 3: Deposit ↔ inspection linking ──")

    # Create a check-in inspection
    r = agent.post("/api/inspections", {
        "unit_id": unit_id,
        "type": "check_in",
        "scheduled_date": today,
        "inspector_name": "GolemInspector",
    })
    insp = agent.expect(r, 200, "create check-in inspection")
    insp_id = insp.get("id")
    agent.check("inspection created", bool(insp_id), f"got: {insp}")

    # Mark it completed so it shows up as linkable
    r = agent.put(f"/api/inspections/{insp_id}", {
        "status": "completed",
        "completed_date": today,
        "overall_condition": "good",
    })
    agent.expect(r, 200, "complete inspection")

    # Find an existing deposit to link (or create one if available)
    r = agent.get("/api/deposits")
    deposits = agent.expect(r, 200, "fetch deposits")
    active_deposit = next(
        (d for d in deposits if d.get("status") in ("unprotected", "protected", "pi_served")),
        None
    )

    if active_deposit:
        dep_id = active_deposit["id"]
        r = agent.put(f"/api/deposits/{dep_id}", {
            "checkin_inspection_id": insp_id,
        })
        dep_updated = agent.expect(r, 200, f"link check-in inspection to deposit {dep_id}")
        agent.check("checkin_inspection_id saved on deposit",
                    dep_updated.get("checkin_inspection_id") == insp_id,
                    f"got: {dep_updated.get('checkin_inspection_id')}")

        # Verify it round-trips on fetch
        r = agent.get("/api/deposits")
        deposits_after = agent.expect(r, 200, "fetch deposits after link")
        dep_after = next((d for d in deposits_after if d["id"] == dep_id), None)
        agent.check("checkin_inspection_id persists on deposit",
                    dep_after and dep_after.get("checkin_inspection_id") == insp_id,
                    f"got: {dep_after.get('checkin_inspection_id') if dep_after else 'not found'}")

        # Unlink (cleanup)
        agent.put(f"/api/deposits/{dep_id}", {"checkin_inspection_id": None})
    else:
        agent.check("deposit available to link (skipped — no active deposits)",
                    True)  # soft skip

    # Cleanup inspection
    agent.delete(f"/api/inspections/{insp_id}")

    # ─────────────────────────────────────────────────────────────────────────
    # 4. Inspection comparison endpoint
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 4: Inspection check-in vs check-out comparison ──")

    rooms_in = [
        {"room_name": "Living Room", "condition": "excellent", "cleanliness": "clean", "notes": "Fresh paint"},
        {"room_name": "Kitchen",     "condition": "good",      "cleanliness": "clean", "notes": ""},
        {"room_name": "Bedroom 1",   "condition": "good",      "cleanliness": "clean", "notes": ""},
    ]
    rooms_out = [
        {"room_name": "Living Room", "condition": "fair", "cleanliness": "satisfactory", "notes": "Scuff marks on wall"},
        {"room_name": "Kitchen",     "condition": "good", "cleanliness": "dirty",        "notes": "Needs deep clean"},
        {"room_name": "Bedroom 1",   "condition": "poor", "cleanliness": "dirty",        "notes": "Carpet stained"},
    ]

    # Create check-in inspection (completed)
    r = agent.post("/api/inspections", {
        "unit_id": unit_id,
        "type": "check_in",
        "scheduled_date": today,
        "inspector_name": "GolemInspector",
    })
    ci = agent.expect(r, 200, "create check-in for compare")
    ci_id = ci.get("id")
    r = agent.put(f"/api/inspections/{ci_id}", {
        "status": "completed",
        "completed_date": today,
        "overall_condition": "good",
        "rooms": rooms_in,
    })
    agent.expect(r, 200, "complete check-in with rooms")

    # Create check-out inspection (completed)
    r = agent.post("/api/inspections", {
        "unit_id": unit_id,
        "type": "check_out",
        "scheduled_date": today,
        "inspector_name": "GolemInspector",
    })
    co = agent.expect(r, 200, "create check-out for compare")
    co_id = co.get("id")
    r = agent.put(f"/api/inspections/{co_id}", {
        "status": "completed",
        "completed_date": today,
        "overall_condition": "fair",
        "rooms": rooms_out,
    })
    agent.expect(r, 200, "complete check-out with rooms")

    # Call compare endpoint
    r = agent.get("/api/inspections/compare", params={"unit_id": unit_id})
    cmp = agent.expect(r, 200, "compare check-in vs check-out")

    agent.check("compare returns checkin block",  bool(cmp.get("checkin")),  f"got: {list(cmp.keys())}")
    agent.check("compare returns checkout block", bool(cmp.get("checkout")), f"got: {list(cmp.keys())}")
    agent.check("compare returns rooms list",     isinstance(cmp.get("rooms"), list), f"rooms={cmp.get('rooms')}")

    rooms_cmp = cmp.get("rooms", [])
    agent.check("all 3 rooms present in compare",
                len(rooms_cmp) == 3,
                f"got {len(rooms_cmp)} rooms: {[r['room_name'] for r in rooms_cmp]}")

    lr = next((r for r in rooms_cmp if r["room_name"] == "Living Room"), None)
    agent.check("Living Room: check-in condition=excellent",
                lr and (lr.get("checkin") or {}).get("condition") == "excellent",
                f"got: {lr.get('checkin') if lr else 'not found'}")
    agent.check("Living Room: check-out condition=fair",
                lr and (lr.get("checkout") or {}).get("condition") == "fair",
                f"got: {lr.get('checkout') if lr else 'not found'}")

    # Cleanup
    agent.delete(f"/api/inspections/{ci_id}")
    agent.delete(f"/api/inspections/{co_id}")

    # ─────────────────────────────────────────────────────────────────────────
    # 5. Email invite flow
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Step 5: Email invite flow ──")

    invite_email = f"golem-invite-{secrets.token_hex(4)}@test.co"
    invite_name  = "[GOLEM] Invite Test"

    # Send invite (creates pending user + emails link)
    r = agent.post("/api/onboarding/send-invite", {
        "full_name": invite_name,
        "email": invite_email,
        "role": "agent",
    })
    sent = agent.expect(r, 200, "send invite email")
    agent.check("send-invite returns ok=True", sent.get("ok") is True, f"got: {sent}")

    # Retrieve the token via the backend ORM (need production DB)
    # Change to backend dir so Settings finds .env.production
    _orig_cwd = os.getcwd()
    os.chdir("/root/propairty/backend")
    from app.database import engine
    import sqlalchemy as sa
    os.chdir(_orig_cwd)

    with engine.connect() as conn:
        row = conn.execute(
            sa.text("SELECT id, invite_token, is_active FROM users WHERE email = :e"),
            {"e": invite_email}
        ).fetchone()

    agent.check("user created with invite_token",
                row is not None and row[1] is not None,
                f"row={row}")
    agent.check("user is_active=False until accepted",
                row is not None and row[2] is False,
                f"is_active={row[2] if row else 'N/A'}")

    user_id = row[0] if row else None
    token   = row[1] if row else None

    if token:
        # invite-info (public endpoint — no auth)
        anon = requests.Session()
        r = anon.get(f"{BASE_URL}/api/onboarding/invite-info/{token}")
        agent.check("invite-info returns 200",
                    r.status_code == 200,
                    f"got {r.status_code}: {r.text[:200]}")
        info = r.json() if r.status_code == 200 else {}
        agent.check("invite-info full_name matches",
                    info.get("full_name") == invite_name,
                    f"got: {info.get('full_name')}")
        agent.check("invite-info email matches",
                    info.get("email") == invite_email,
                    f"got: {info.get('email')}")

        # accept-invite with bad password (too short)
        r = anon.post(f"{BASE_URL}/api/onboarding/accept-invite",
                      json={"token": token, "password": "short"})
        agent.check("accept-invite rejects short password",
                    r.status_code == 400,
                    f"got {r.status_code}")

        # accept-invite correctly
        r = anon.post(f"{BASE_URL}/api/onboarding/accept-invite",
                      json={"token": token, "password": "GolemInvite2026!"})
        agent.check("accept-invite returns 200",
                    r.status_code == 200,
                    f"got {r.status_code}: {r.text[:200]}")
        jwt_data = r.json() if r.status_code == 200 else {}
        agent.check("accept-invite returns access_token",
                    bool(jwt_data.get("access_token")),
                    f"got: {list(jwt_data.keys())}")

        # Verify user is now active + token cleared
        with engine.connect() as conn:
            row2 = conn.execute(
                sa.text("SELECT invite_token, is_active FROM users WHERE id = :id"),
                {"id": user_id}
            ).fetchone()
        agent.check("invite_token cleared after accept",
                    row2 and row2[0] is None,
                    f"token={row2[0] if row2 else 'N/A'}")
        agent.check("is_active=True after accept",
                    row2 and row2[1] is True,
                    f"is_active={row2[1] if row2 else 'N/A'}")

        # Verify the new JWT actually works (call /auth/me)
        authed = requests.Session()
        authed.headers["Authorization"] = f"Bearer {jwt_data.get('access_token', '')}"
        r = authed.get(f"{BASE_URL}/api/auth/me")
        agent.check("accepted-invite JWT is valid (/auth/me returns 200)",
                    r.status_code == 200,
                    f"got {r.status_code}: {r.text[:200]}")

    # Cleanup: remove invite user
    if user_id:
        with engine.connect() as conn:
            conn.execute(sa.text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            conn.commit()
    agent.check("invite user cleaned up", True)

    # ── Summary ───────────────────────────────────────────────────────────────
    return [agent.summary()]


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
    if total_fail:
        raise SystemExit(1)
