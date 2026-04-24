"""AgentGolem — acts as a letting agent."""
from base import BaseGolem


class AgentGolem(BaseGolem):
    name = "AgentGoilem"
    email = "agentgoilem@propairty.co.uk"
    login_url = "/api/auth/token"

    # ── Actions ───────────────────────────────────────────────────────────────

    def get_units(self) -> list:
        r = self.get("/api/properties")
        data = self.expect(r, 200, "fetch properties")
        units = []
        for prop in (data if isinstance(data, list) else []):
            for u in prop.get("units", []):
                units.append({**u, "property_name": prop["name"]})
        return units

    def create_maintenance(self, unit_id: int, title: str, priority: str = "medium") -> dict:
        r = self.post("/api/maintenance", {
            "unit_id": unit_id,
            "title": title,
            "description": f"[GOILEM TEST] {title}",
            "priority": priority,
            "reported_by": self.name,
        })
        return self.expect(r, 200, f"create maintenance: {title}")

    def assign_contractor(self, req_id: int, contractor_id: int) -> dict:
        # Get current request first
        r = self.get(f"/api/maintenance")
        reqs = self.expect(r, 200, "fetch maintenance list")
        req = next((x for x in reqs if x["id"] == req_id), None)
        if not req:
            self._failures.append(f"[{self.name}] request {req_id} not found in list")
            return {}
        # Update with contractor assigned
        payload = {
            "unit_id": req["unit_id"],
            "title": req["title"],
            "description": req.get("description", ""),
            "priority": req["priority"],
            "status": req["status"],
            "contractor_id": contractor_id,
        }
        r = self.put(f"/api/maintenance/{req_id}", payload)
        return self.expect(r, 200, f"assign contractor {contractor_id} to job {req_id}")

    def approve_quote(self, req_id: int) -> dict:
        r = self.post(f"/api/maintenance/{req_id}/quote-decision", {"decision": "approved"})
        return self.expect(r, 200, f"approve quote on job {req_id}")

    def reject_quote(self, req_id: int) -> dict:
        r = self.post(f"/api/maintenance/{req_id}/quote-decision", {"decision": "rejected"})
        return self.expect(r, 200, f"reject quote on job {req_id}")

    def set_scheduled_date(self, req_id: int, date_str: str) -> dict:
        r = self.post(f"/api/maintenance/{req_id}/scheduled-date", {"scheduled_date": date_str})
        return self.expect(r, 200, f"set scheduled date on job {req_id}")

    def proposed_date_decision(self, req_id: int, decision: str) -> dict:
        r = self.post(f"/api/maintenance/{req_id}/proposed-date-decision", {"decision": decision})
        return self.expect(r, 200, f"proposed date {decision} on job {req_id}")

    def mark_invoice_paid(self, req_id: int) -> dict:
        r = self.post(f"/api/maintenance/{req_id}/mark-paid")
        return self.expect(r, 200, f"mark invoice paid on job {req_id}")

    def add_note(self, req_id: int, body: str) -> dict:
        r = self.post(f"/api/maintenance/{req_id}/notes", {"body": body})
        return self.expect(r, 200, f"add note to job {req_id}")

    def get_notes(self, req_id: int) -> list:
        r = self.get(f"/api/maintenance/{req_id}/notes")
        return self.expect(r, 200, f"get notes for job {req_id}")

    def send_message_to_contractor(self, contractor_id: int, body: str) -> dict:
        r = self.post("/api/messages", {
            "entity_type": "contractor",
            "entity_id": contractor_id,
            "body": body,
            "direction": "outbound",
        })
        return self.expect(r, 200, "send message to contractor")

    def get_dashboard(self) -> dict:
        r = self.get("/api/dashboard")
        return self.expect(r, 200, "fetch dashboard")

    def get_contractors(self) -> list:
        r = self.get("/api/contractors")
        return self.expect(r, 200, "fetch contractors")

    def update_job_status(self, req_id: int, status: str, unit_id: int, title: str,
                          priority: str, description: str = "") -> dict:
        r = self.put(f"/api/maintenance/{req_id}", {
            "unit_id": unit_id,
            "title": title,
            "description": description,
            "priority": priority,
            "status": status,
        })
        return self.expect(r, 200, f"update job {req_id} status={status}")

    def delete_maintenance(self, req_id: int) -> dict:
        r = self.delete(f"/api/maintenance/{req_id}")
        return self.expect(r, 200, f"delete job {req_id}")
