"""TenantGolem — acts as a tenant."""
from base import BaseGolem


class TenantGolem(BaseGolem):
    name = "TenantGoilem"
    email = "tenantgoilem@propairty.co.uk"
    login_url = "/api/tenant/token"

    def submit_maintenance(self, title: str, description: str = "", priority: str = "medium") -> dict:
        r = self.post("/api/tenant/portal/maintenance", {
            "title": title,
            "description": description or f"[GOILEM TEST] {title}",
            "priority": priority,
        })
        return self.expect(r, 200, f"tenant submit maintenance: {title}")

    def get_maintenance(self) -> list:
        r = self.get("/api/tenant/portal/maintenance")
        return self.expect(r, 200, "tenant fetch maintenance")

    def get_messages(self) -> list:
        r = self.get("/api/tenant/portal/messages")
        return self.expect(r, 200, "tenant fetch messages")

    def send_message(self, body: str) -> dict:
        r = self.post("/api/tenant/portal/messages", {"body": body})
        return self.expect(r, 200, "tenant send message")

    def get_documents(self) -> list:
        r = self.get("/api/tenant/portal/documents")
        return self.expect(r, 200, "tenant fetch documents")

    def get_notices(self) -> list:
        r = self.get("/api/tenant/portal/notices")
        return self.expect(r, 200, "tenant fetch notices")

    def get_profile(self) -> dict:
        r = self.get("/api/tenant/portal/me")
        return self.expect(r, 200, "tenant fetch profile")

    def get_unread_count(self) -> int:
        r = self.get("/api/tenant/portal/messages/unread-count")
        data = self.expect(r, 200, "tenant unread count")
        return data.get("count", 0) if isinstance(data, dict) else 0
