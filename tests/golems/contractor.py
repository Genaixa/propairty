"""ContractorGolem — acts as a trade contractor."""
from base import BaseGolem


class ContractorGolem(BaseGolem):
    name = "ContractorGoilem"
    email = "contractorgoilem@propairty.co.uk"
    login_url = "/api/contractor/token"

    def get_jobs(self, status: str = None) -> list:
        path = "/api/contractor/jobs"
        if status:
            path += f"?status={status}"
        r = self.get(path)
        return self.expect(r, 200, f"contractor fetch jobs (status={status})")

    def accept_job(self, job_id: int) -> dict:
        r = self.post(f"/api/contractor/jobs/{job_id}/accept")
        return self.expect(r, 200, f"contractor accept job {job_id}")

    def decline_job(self, job_id: int) -> dict:
        r = self.post(f"/api/contractor/jobs/{job_id}/decline")
        return self.expect(r, 200, f"contractor decline job {job_id}")

    def submit_quote(self, job_id: int, amount: float, proposed_date: str, notes: str = "") -> dict:
        # Backend uses Form(...) — must send as multipart, not JSON
        saved_ct = self.session.headers.pop("Content-Type", None)
        r = self.session.post(
            f"https://propairty.co.uk/api/contractor/jobs/{job_id}/quote",
            data={
                "amount": str(amount),
                "proposed_date": proposed_date,
                "notes": notes or f"Quote submitted by {self.name}",
            },
        )
        if saved_ct:
            self.session.headers["Content-Type"] = saved_ct
        return self.expect(r, 200, f"contractor submit quote £{amount} proposed {proposed_date} for job {job_id}")

    def update_job_status(self, job_id: int, status: str, cost: float = None) -> dict:
        payload: dict = {"status": status}
        if cost is not None:
            payload["actual_cost"] = cost
        r = self.put(f"/api/contractor/jobs/{job_id}", payload)
        return self.expect(r, 200, f"contractor update job {job_id} → {status}")

    def add_note(self, job_id: int, body: str) -> dict:
        r = self.post(f"/api/contractor/jobs/{job_id}/notes", {"body": body})
        return self.expect(r, 200, f"contractor add note to job {job_id}")

    def get_notes(self, job_id: int) -> list:
        r = self.get(f"/api/contractor/jobs/{job_id}/notes")
        return self.expect(r, 200, f"contractor get notes for job {job_id}")

    def get_messages(self) -> list:
        r = self.get("/api/contractor/messages")
        return self.expect(r, 200, "contractor fetch messages")

    def send_message(self, body: str) -> dict:
        r = self.post("/api/contractor/messages", {"body": body})
        return self.expect(r, 200, "contractor send message")

    def get_unread_count(self) -> int:
        r = self.get("/api/contractor/messages/unread-count")
        data = self.expect(r, 200, "contractor unread count")
        return data.get("count", 0) if isinstance(data, dict) else 0

    def update_profile(self, trade: str = "General", notes: str = "") -> dict:
        r = self.put("/api/contractor/profile", {
            "full_name": "Contractor Goilem",
            "phone": "07700000003",
            "email": self.email,
            "company_name": "Goilem Trades Ltd",
            "trade": trade,
            "notes": notes,
        })
        return self.expect(r, 200, "contractor update profile")

    def get_profile(self) -> dict:
        r = self.get("/api/contractor/profile")
        return self.expect(r, 200, "contractor get profile")

    def propose_date(self, job_id: int, date_str: str) -> dict:
        r = self.post(f"/api/contractor/jobs/{job_id}/propose-date", {"proposed_date": date_str})
        return self.expect(r, 200, f"contractor propose date {date_str} for job {job_id}")
