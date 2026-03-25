from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Float
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    unit = relationship("Unit", back_populates="maintenance_requests")
    contractor = relationship("Contractor", back_populates="jobs")
