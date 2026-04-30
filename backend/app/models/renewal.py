from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class LeaseRenewal(Base):
    __tablename__ = "lease_renewals"

    id = Column(Integer, primary_key=True, index=True)
    lease_id = Column(Integer, ForeignKey("leases.id"), nullable=False)
    proposed_rent = Column(Float, nullable=False)
    proposed_start = Column(Date, nullable=False)
    proposed_end = Column(Date, nullable=True)
    is_periodic = Column(String, default="fixed")  # fixed, periodic
    status = Column(String, default="sent")  # sent, accepted, declined, expired
    agent_notes = Column(Text, nullable=True)
    tenant_notes = Column(Text, nullable=True)
    landlord_viewed_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)
    responded_via = Column(String, nullable=True)  # "portal" or "agent"

    lease = relationship("Lease", back_populates="renewals")
