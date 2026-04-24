from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


STAGES = [
    "enquiry",
    "viewing_booked",
    "viewed",
    "referencing",
    "approved",
    "tenancy_created",
]
TERMINAL_STAGES = ["rejected", "withdrawn"]
SOURCES = ["Rightmove", "Zoopla", "SpareRoom", "OpenRent", "Direct", "Referral", "Other"]


class Applicant(Base):
    __tablename__ = "applicants"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)

    full_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    source = Column(String, nullable=True)           # Rightmove, Zoopla, etc.
    status = Column(String, default="enquiry")       # pipeline stage
    viewing_date = Column(DateTime(timezone=True), nullable=True)
    desired_move_in = Column(Date, nullable=True)
    monthly_budget = Column(String, nullable=True)   # free text e.g. "£900–£1,000"

    # Referencing & right-to-rent
    right_to_rent_checked = Column(Boolean, default=False, nullable=False)
    referencing_status = Column(String, default="not_started")  # not_started, in_progress, passed, failed, referred

    notes = Column(Text, nullable=True)
    viewing_reminder_sent = Column(Boolean, default=False, nullable=True)

    # Preferences
    preferred_areas = Column(Text, nullable=True)   # comma-separated
    must_haves = Column(Text, nullable=True)         # comma-separated
    dislikes = Column(Text, nullable=True)           # comma-separated
    min_bedrooms = Column(Integer, nullable=True)
    max_bedrooms = Column(Integer, nullable=True)

    # Follow-up
    follow_up_date = Column(Date, nullable=True)
    follow_up_note = Column(Text, nullable=True)
    assigned_agent = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    property = relationship("Property")
    unit = relationship("Unit")
