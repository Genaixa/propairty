from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class PortalMessage(Base):
    """Direct messages between a landlord and their agent."""
    __tablename__ = "portal_messages"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    landlord_id = Column(Integer, ForeignKey("landlords.id"), nullable=False)
    sender_type = Column(String, nullable=False)  # "landlord" or "agent"
    body = Column(String, nullable=False)
    read = Column(Boolean, default=False)  # True once the other party has seen it
    created_at = Column(DateTime(timezone=True), server_default=func.now())
