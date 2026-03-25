from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Text
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

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    property = relationship("Property")
    unit = relationship("Unit")
