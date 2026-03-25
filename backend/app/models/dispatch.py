from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class DispatchSettings(Base):
    __tablename__ = "dispatch_settings"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), unique=True, nullable=False)
    # Auto mode: when ON the system dispatches automatically
    auto_mode = Column(Boolean, default=False)
    # Always auto-dispatch urgent jobs even in manual mode
    urgent_auto_dispatch = Column(Boolean, default=True)
    # How many same-trade jobs in same area before auto-dispatching
    area_threshold = Column(Integer, default=3)
    # Max days a job can sit in queue before auto-dispatching even below threshold
    max_wait_days = Column(Integer, default=7)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DispatchQueue(Base):
    __tablename__ = "dispatch_queue"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    maintenance_request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False, unique=True)
    trade = Column(String, nullable=False)       # plumber, electrician, gas_engineer, etc.
    area = Column(String, nullable=False)        # postcode district e.g. "NE8"
    city = Column(String, nullable=True)         # city for display
    urgency = Column(String, default="standard") # urgent, standard
    status = Column(String, default="queued")    # queued, dispatched, cancelled
    ai_summary = Column(Text, nullable=True)     # AI one-line summary of the issue
    ai_confidence = Column(String, nullable=True) # high, medium, low
    batch_id = Column(Integer, ForeignKey("dispatch_batches.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    dispatched_at = Column(DateTime(timezone=True), nullable=True)

    job = relationship("MaintenanceRequest", foreign_keys=[maintenance_request_id])
    batch = relationship("DispatchBatch", back_populates="items")


class DispatchBatch(Base):
    __tablename__ = "dispatch_batches"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    contractor_id = Column(Integer, ForeignKey("contractors.id"), nullable=True)
    trade = Column(String, nullable=False)
    area = Column(String, nullable=False)
    job_count = Column(Integer, default=0)
    note = Column(Text, nullable=True)
    dispatched_by = Column(String, nullable=True)  # "agent:<user_id>" or "auto"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contractor = relationship("Contractor")
    items = relationship("DispatchQueue", back_populates="batch")
