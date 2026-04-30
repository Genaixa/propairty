"""
HMRC Making Tax Digital for Income Tax — OAuth + submission shell.

Sandbox: https://test-api.service.hmrc.gov.uk
Production: https://api.service.hmrc.gov.uk

Register your app at: https://developer.service.hmrc.gov.uk
Set env vars: HMRC_CLIENT_ID, HMRC_CLIENT_SECRET, HMRC_SANDBOX=true/false
"""
import json
import os
import secrets
import urllib.parse
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.config import settings

router = APIRouter(prefix="/api/mtd", tags=["mtd"])

# ── HMRC endpoints ─────────────────────────────────────────────────────────────

def _hmrc_base() -> str:
    return "https://test-api.service.hmrc.gov.uk" if settings.hmrc_sandbox else "https://api.service.hmrc.gov.uk"

SCOPES = "read:self-assessment write:self-assessment"

# ── Persistent token store (survives restarts) ─────────────────────────────────
_TOKEN_FILE = Path(__file__).parent.parent.parent / "mtd_tokens.json"
_oauth_states: dict[str, int] = {}


def _load_tokens() -> dict[int, dict]:
    try:
        return {int(k): v for k, v in json.loads(_TOKEN_FILE.read_text()).items()}
    except Exception:
        return {}


def _save_tokens(tokens: dict[int, dict]) -> None:
    try:
        _TOKEN_FILE.write_text(json.dumps({str(k): v for k, v in tokens.items()}))
    except Exception:
        pass


_tokens: dict[int, dict] = _load_tokens()


def _is_connected(org_id: int) -> bool:
    t = _tokens.get(org_id, {})
    if not t.get("access_token"):
        return False
    expires = t.get("expires_at")
    if expires and datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        return False
    return True


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
def mtd_status(current_user: User = Depends(get_current_user)):
    org_id = current_user.organisation_id
    configured = bool(settings.hmrc_client_id and settings.hmrc_client_secret)
    connected = _is_connected(org_id)
    token_info = _tokens.get(org_id, {})
    return {
        "configured": configured,
        "connected": connected,
        "sandbox": settings.hmrc_sandbox,
        "hmrc_base": _hmrc_base(),
        "nino": token_info.get("nino"),
        "business_id": token_info.get("business_id"),
        "expires_at": token_info.get("expires_at"),
    }


# ── OAuth flow ────────────────────────────────────────────────────────────────

@router.get("/connect")
def mtd_connect(current_user: User = Depends(get_current_user)):
    """Step 1 — redirect agent to HMRC Government Gateway login."""
    if not settings.hmrc_client_id:
        raise HTTPException(400, "HMRC_CLIENT_ID not configured")
    state = secrets.token_urlsafe(16)
    _oauth_states[state] = current_user.organisation_id
    redirect_uri = f"{settings.app_base_url}/api/mtd/callback"
    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": settings.hmrc_client_id,
        "scope": SCOPES,
        "state": state,
        "redirect_uri": redirect_uri,
    })
    auth_url = f"{_hmrc_base()}/oauth/authorize?{params}"
    return {"auth_url": auth_url}


@router.get("/callback")
async def mtd_callback(code: str = "", state: str = "", error: str = "", db: Session = Depends(get_db)):
    """Step 2 — HMRC redirects back here with an auth code."""
    if error:
        return RedirectResponse(f"{settings.app_base_url}/accounting?mtd_error={error}")

    org_id = _oauth_states.pop(state, None)
    if not org_id or not code:
        return RedirectResponse(f"{settings.app_base_url}/accounting?mtd_error=invalid_state")

    import httpx
    redirect_uri = f"{settings.app_base_url}/api/mtd/callback"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{_hmrc_base()}/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": settings.hmrc_client_id,
                    "client_secret": settings.hmrc_client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            token_data = r.json()
    except Exception as exc:
        return RedirectResponse(f"{settings.app_base_url}/accounting?mtd_error=token_exchange_failed")

    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 14400))).isoformat()
    existing = _tokens.get(org_id, {})
    _tokens[org_id] = {
        **existing,
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": expires_at,
    }
    _save_tokens(_tokens)
    return RedirectResponse(f"{settings.app_base_url}/accounting?mtd_connected=1")


@router.post("/disconnect")
def mtd_disconnect(current_user: User = Depends(get_current_user)):
    _tokens.pop(current_user.organisation_id, None)
    _save_tokens(_tokens)
    return {"ok": True}


@router.post("/profile")
def mtd_save_profile(
    nino: str,
    business_id: str = "",
    current_user: User = Depends(get_current_user),
):
    """Save NINO and optional business_id to the in-memory token store."""
    org_id = current_user.organisation_id
    if org_id not in _tokens:
        _tokens[org_id] = {}
    _tokens[org_id]["nino"] = nino.strip().upper()
    if business_id.strip():
        _tokens[org_id]["business_id"] = business_id.strip()
    _save_tokens(_tokens)
    return {"ok": True, "nino": _tokens[org_id]["nino"], "business_id": _tokens[org_id].get("business_id")}


@router.get("/businesses")
async def mtd_list_businesses(current_user: User = Depends(get_current_user)):
    """Fetch UK property business IDs via the Obligations API (already subscribed)."""
    org_id = current_user.organisation_id
    if not _is_connected(org_id):
        raise HTTPException(400, "Not connected")
    nino = _tokens[org_id].get("nino")
    if not nino:
        raise HTTPException(400, "NINO not set — save your NINO first")
    token = _tokens[org_id]["access_token"]
    import httpx
    # Obligations (MTD) v3.0 — returns obligations per business including businessId
    url = f"{_hmrc_base()}/obligations/details/{nino}/income-and-expenditure"
    params = {"typeOfBusiness": "uk-property"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params=params, headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.hmrc.3.0+json",
            })
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            # No obligations yet — test user has no property business registered
            return {"businesses": [], "stored": None, "hint": "No UK property business found for this NINO in the HMRC sandbox. You may need to create one via the Self Assessment Test Support API, or enter the business ID manually."}
        raise HTTPException(502, f"HMRC obligations lookup failed: {exc}")
    except Exception as exc:
        raise HTTPException(502, f"HMRC obligations lookup failed: {exc}")

    businesses = [
        {"id": ob.get("businessId"), "type": ob.get("typeOfBusiness")}
        for ob in data.get("obligations", [])
        if ob.get("typeOfBusiness") in ("uk-property", "foreign-property") and ob.get("businessId")
    ]
    # De-duplicate
    seen = set()
    unique = [b for b in businesses if not (b["id"] in seen or seen.add(b["id"]))]

    if unique and not _tokens[org_id].get("business_id"):
        _tokens[org_id]["business_id"] = unique[0]["id"]
        _save_tokens(_tokens)
    return {"businesses": unique, "stored": _tokens[org_id].get("business_id")}


# ── Quarterly submissions ──────────────────────────────────────────────────────

@router.get("/quarters")
def mtd_quarters(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return quarterly period list with data-ready status."""
    from app.routers.accounting import _build_report_data
    org_id = current_user.organisation_id

    now = date.today()
    tax_year_start = now.year if now >= date(now.year, 4, 6) else now.year - 1
    quarters = []
    for y in [tax_year_start - 1, tax_year_start]:
        quarters += [
            {"id": f"Q1-{y}", "label": f"Q1 {y}/{str(y+1)[-2:]}", "from": date(y, 4, 6),  "to": date(y, 7, 5),  "due": date(y, 8, 5)},
            {"id": f"Q2-{y}", "label": f"Q2 {y}/{str(y+1)[-2:]}", "from": date(y, 7, 6),  "to": date(y, 10, 5), "due": date(y, 11, 5)},
            {"id": f"Q3-{y}", "label": f"Q3 {y}/{str(y+1)[-2:]}", "from": date(y, 10, 6), "to": date(y+1, 1, 5),"due": date(y+1, 2, 5)},
            {"id": f"Q4-{y}", "label": f"Q4 {y}/{str(y+1)[-2:]}", "from": date(y+1, 1, 6),"to": date(y+1, 4, 5),"due": date(y+1, 5, 31)},
        ]

    result = []
    for q in sorted(quarters, key=lambda x: x["from"], reverse=True):
        base_year = int(q["id"].split("-")[1])
        pre_mtd = base_year < 2026
        status = "upcoming" if q["from"] > now else ("overdue" if q["due"] < now else "due")
        result.append({
            "id": q["id"],
            "label": q["label"],
            "from": str(q["from"]),
            "to": str(q["to"]),
            "due": str(q["due"]),
            "status": status,
            "submitted": False,
            "pre_mtd": pre_mtd,
        })
    return result


@router.get("/quarters/{quarter_id}/preview")
def mtd_quarter_preview(
    quarter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Build the HMRC-format JSON payload for a quarter without submitting."""
    from app.routers.accounting import _build_report_data
    # Parse quarter_id like "Q1-2025"
    parts = quarter_id.split("-")
    if len(parts) != 2:
        raise HTTPException(400, "Invalid quarter_id")
    q_num, y = parts[0], int(parts[1])
    quarter_dates = {
        "Q1": (date(y, 4, 6),  date(y, 7, 5)),
        "Q2": (date(y, 7, 6),  date(y, 10, 5)),
        "Q3": (date(y, 10, 6), date(y+1, 1, 5)),
        "Q4": (date(y+1, 1, 6),date(y+1, 4, 5)),
    }
    if q_num not in quarter_dates:
        raise HTTPException(400, "Invalid quarter")
    from_date, to_date = quarter_dates[q_num]

    data = _build_report_data(current_user.organisation_id, from_date, to_date, None, db)

    income_amount = round(data["total_income"], 2)
    expense_amount = round(data["total_expenditure"], 2)

    # Property Business API v6.0 — ukNonFhlProperty structure, omit zero-value fields
    non_fhl_income: dict = {}
    if income_amount:
        non_fhl_income["periodAmount"] = income_amount

    non_fhl_expenses: dict = {}
    if expense_amount:
        non_fhl_expenses["repairsAndMaintenance"] = expense_amount

    non_fhl: dict = {}
    if non_fhl_income:
        non_fhl["income"] = non_fhl_income
    if non_fhl_expenses:
        non_fhl["expenses"] = non_fhl_expenses

    payload: dict = {
        "fromDate": str(from_date),
        "toDate": str(to_date),
    }
    if non_fhl:
        payload["ukNonFhlProperty"] = non_fhl

    return {"quarter": quarter_id, "payload": payload, "summary": {
        "income": income_amount,
        "expenditure": expense_amount,
        "net": data["net_profit"],
    }}


@router.post("/quarters/{quarter_id}/submit")
async def mtd_submit_quarter(
    quarter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a quarterly update to HMRC (requires connected account and NINO)."""
    org_id = current_user.organisation_id
    if not _is_connected(org_id):
        raise HTTPException(400, "HMRC account not connected — use /api/mtd/connect first")

    token = _tokens[org_id]["access_token"]
    nino = _tokens[org_id].get("nino")
    if not nino:
        raise HTTPException(400, "NINO not set — enter it in the MTD settings panel")
    business_id = _tokens[org_id].get("business_id")
    if not business_id:
        raise HTTPException(400, "Business ID not set — click 'Fetch businesses' in the MTD panel")

    # Get the payload
    preview = mtd_quarter_preview(quarter_id, current_user, db)
    payload = preview["payload"]

    # Derive HMRC tax year string (e.g. "2026-27") from quarter base year
    q_num, y_str = quarter_id.split("-")
    y = int(y_str)
    tax_year = f"{y}-{str(y + 1)[-2:]}"

    # MTD ITSA mandatory from 2026-27 onwards
    if y < 2026:
        raise HTTPException(400, "MTD for Income Tax only applies from tax year 2026-27 onwards.")

    # HMRC sandbox only supports up to 2024-25 — remap for testing
    if settings.hmrc_sandbox and y >= 2025:
        tax_year = "2024-25"

    # In sandbox, remap dates into the 2024-25 tax year window
    if settings.hmrc_sandbox and tax_year == "2024-25":
        payload = {
            **payload,
            "fromDate": "2024-04-06",
            "toDate": "2025-04-05",
        }

    import httpx
    url = f"{_hmrc_base()}/individuals/business/property/uk/{nino}/{business_id}/period/{tax_year}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.hmrc.6.0+json",
                "Content-Type": "application/json",
            }
            if settings.hmrc_sandbox:
                headers["Gov-Test-Scenario"] = "DEFAULT"
            r = await client.post(url, json=payload, headers=headers)
            if not r.is_success:
                try:
                    hmrc_detail = r.json()
                except Exception:
                    hmrc_detail = r.text
                raise HTTPException(502, {
                    "status": r.status_code,
                    "url": url,
                    "payload": payload,
                    "hmrc_error": hmrc_detail,
                })
            return {"ok": True, "quarter": quarter_id, "hmrc_response": r.json()}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"HMRC submission failed: {exc}")


@router.get("/probe-years")
async def mtd_probe_years(current_user: User = Depends(get_current_user)):
    """Try a minimal POST to HMRC for each candidate tax year and report which ones don't return RULE_TAX_YEAR_NOT_SUPPORTED."""
    org_id = current_user.organisation_id
    if not _is_connected(org_id):
        raise HTTPException(400, "Not connected")
    nino = _tokens[org_id].get("nino")
    business_id = _tokens[org_id].get("business_id")
    if not nino or not business_id:
        raise HTTPException(400, "NINO and business ID required")
    token = _tokens[org_id]["access_token"]

    import httpx
    results = {}
    # Try a range of candidate years
    candidate_years = ["2020-21","2021-22","2022-23","2023-24","2024-25","2025-26","2026-27","2027-28"]
    minimal_payload = {
        "fromDate": "2024-04-06",
        "toDate": "2024-07-05",
        "ukNonFhlProperty": {"income": {"periodAmount": 100.00}},
    }
    async with httpx.AsyncClient(timeout=15) as client:
        for ty in candidate_years:
            url = f"{_hmrc_base()}/individuals/business/property/uk/{nino}/{business_id}/period/{ty}"
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.hmrc.6.0+json",
                "Content-Type": "application/json",
                "Gov-Test-Scenario": "DEFAULT",
            }
            try:
                r = await client.post(url, json=minimal_payload, headers=headers)
                try:
                    body = r.json()
                except Exception:
                    body = r.text
                results[ty] = {"status": r.status_code, "body": body}
            except Exception as exc:
                results[ty] = {"status": "error", "body": str(exc)}
    return results
