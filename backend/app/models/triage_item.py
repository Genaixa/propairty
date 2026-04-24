from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.database import Base

class TriageItem(Base):
    __tablename__ = "triage_items"

    id             = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    source         = Column(String, nullable=False)   # "email" | "portal_maintenance" | "portal_message"
    from_name      = Column(String, nullable=True)
    from_email     = Column(String, nullable=True)
    subject        = Column(String, nullable=True)
    body           = Column(Text, nullable=True)
    category       = Column(String, nullable=True)
    confidence     = Column(Integer, nullable=True)
    urgency        = Column(String, nullable=True)
    summary        = Column(Text, nullable=True)
    suggested_reply = Column(Text, nullable=True)
    action_items   = Column(JSON, nullable=True)
    sender_profile = Column(JSON, nullable=True)
    records_created = Column(JSON, nullable=True)
    status         = Column(String, default="pending")  # pending | actioned | dismissed
    ref_type       = Column(String, nullable=True)   # "maintenance_request" | "portal_message"
    ref_id         = Column(Integer, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
