from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Text, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, default="medium")  # low, medium, high, urgent
    status = Column(String, default="open")  # open, in_progress, completed, cancelled
    reported_by = Column(String, nullable=True)
    reported_by_tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    assigned_to = Column(String, nullable=True)
    contractor_id = Column(Integer, ForeignKey("contractors.id"), nullable=True)
    estimated_cost = Column(Float, nullable=True)
    actual_cost = Column(Float, nullable=True)
    invoice_ref = Column(String, nullable=True)
    invoice_paid = Column(Boolean, default=False, nullable=True)
    tenant_satisfied = Column(Boolean, nullable=True, default=None)
    tenant_feedback = Column(Text, nullable=True)
    contractor_viewed_at = Column(DateTime(timezone=True), nullable=True)
    contractor_accepted = Column(Boolean, nullable=True)   # None=pending, True=accepted, False=declined
    contractor_quote = Column(Float, nullable=True)        # quote submitted by contractor
    quote_status = Column(String, nullable=True)           # pending | approved | rejected
    scheduled_date = Column(Date, nullable=True)           # target date set by agent
    proposed_date = Column(Date, nullable=True)            # alternative date proposed by contractor
    proposed_date_status = Column(String, nullable=True)   # pending | accepted | rejected
    ai_triage = Column(Text, nullable=True)  # JSON blob from Claude vision analysis
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    unit = relationship("Unit", back_populates="maintenance_requests")
    contractor = relationship("Contractor", back_populates="jobs")
