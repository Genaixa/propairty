"""BaseGolem — authenticated HTTP client with action logging."""
import requests
import time
import json
from datetime import datetime
from typing import Optional

BASE_URL = "https://propairty.co.uk"
GOLEM_PASSWORD = "Golem_Test_2024!"


class GolemError(Exception):
    pass


class BaseGolem:
    name: str
    email: str
    login_url: str
    token_key: str = "access_token"  # field in login response

    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.token: Optional[str] = None
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.log: list[dict] = []
        self._failures: list[str] = []

    # ── Auth ──────────────────────────────────────────────────────────────────

    def login(self) -> "BaseGolem":
        resp = self.session.post(
            f"{BASE_URL}{self.login_url}",
            data={"username": self.email, "password": getattr(self, "password", GOLEM_PASSWORD)},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if resp.status_code != 200:
            raise GolemError(f"{self.name} login failed: {resp.status_code} {resp.text}")
        self.token = resp.json()[self.token_key]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self._record("LOGIN", self.login_url, resp.status_code, ok=True)
        return self

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def get(self, path: str, **kwargs) -> requests.Response:
        return self._req("GET", path, **kwargs)

    def post(self, path: str, json_body=None, **kwargs) -> requests.Response:
        return self._req("POST", path, json=json_body, **kwargs)

    def put(self, path: str, json_body=None, **kwargs) -> requests.Response:
        return self._req("PUT", path, json=json_body, **kwargs)

    def patch(self, path: str, json_body=None, **kwargs) -> requests.Response:
        return self._req("PATCH", path, json=json_body, **kwargs)

    def delete(self, path: str, **kwargs) -> requests.Response:
        return self._req("DELETE", path, **kwargs)

    def _req(self, method: str, path: str, expect: int = None, **kwargs) -> requests.Response:
        url = f"{BASE_URL}{path}"
        resp = self.session.request(method, url, **kwargs)
        ok = resp.status_code < 400 if expect is None else resp.status_code == expect
        self._record(method, path, resp.status_code, ok=ok, body=resp.text[:300] if not ok else None)
        return resp

    # ── Assertions ────────────────────────────────────────────────────────────

    def check(self, description: str, condition: bool, detail: str = ""):
        status = "PASS" if condition else "FAIL"
        msg = f"[{self.name}] {status}: {description}"
        if not condition:
            msg += f" | {detail}"
            self._failures.append(msg)
        if self.verbose or not condition:
            print(msg)
        self._record("CHECK", description, status, ok=condition)
        return condition

    def expect(self, resp: requests.Response, code: int = 200, label: str = "") -> dict:
        ok = resp.status_code == code
        self.check(label or f"{resp.request.method} {resp.request.path_url}", ok,
                   f"expected {code}, got {resp.status_code}: {resp.text[:200]}")
        try:
            return resp.json()
        except Exception:
            return {}

    # ── Logging ───────────────────────────────────────────────────────────────

    def _record(self, action: str, target: str, status, ok: bool, body: str = None):
        entry = {
            "ts": datetime.utcnow().isoformat(),
            "golem": self.name,
            "action": action,
            "target": target,
            "status": status,
            "ok": ok,
        }
        if body:
            entry["error_body"] = body
        self.log.append(entry)
        if self.verbose and action not in ("CHECK",):
            icon = "✓" if ok else "✗"
            print(f"  {icon} [{self.name}] {action} {target} → {status}")

    def summary(self) -> dict:
        total = len([e for e in self.log if e["action"] == "CHECK"])
        passed = len([e for e in self.log if e["action"] == "CHECK" and e["ok"]])
        return {
            "golem": self.name,
            "checks": total,
            "passed": passed,
            "failed": total - passed,
            "failures": self._failures,
        }
