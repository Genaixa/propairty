"""LandlordGolem — acts as a property owner."""
from base import BaseGolem


class LandlordGolem(BaseGolem):
    name = "LandlordGoilem"
    email = "landlordgoilem@propairty.co.uk"
    login_url = "/api/landlord/token"

    def get_maintenance(self) -> list:
        r = self.get("/api/landlord/portal/maintenance")
        return self.expect(r, 200, "landlord fetch maintenance")

    def get_messages(self) -> list:
        r = self.get("/api/landlord/portal/messages")
        return self.expect(r, 200, "landlord fetch messages")

    def send_message(self, body: str) -> dict:
        r = self.post("/api/landlord/portal/messages", {"body": body})
        return self.expect(r, 200, "landlord send message")

    def get_notices(self) -> list:
        r = self.get("/api/landlord/portal/notices")
        return self.expect(r, 200, "landlord fetch notices")

    def get_documents(self) -> list:
        r = self.get("/api/landlord/portal/documents")
        return self.expect(r, 200, "landlord fetch documents")

    def get_statement(self) -> dict:
        r = self.get("/api/landlord/portal/statement")
        return self.expect(r, 200, "landlord fetch statement")

    def get_profile(self) -> dict:
        r = self.get("/api/landlord/portal/me")
        return self.expect(r, 200, "landlord fetch profile")

    def get_unread_count(self) -> int:
        r = self.get("/api/landlord/portal/messages/unread-count")
        data = self.expect(r, 200, "landlord unread count")
        return data.get("count", 0) if isinstance(data, dict) else 0
