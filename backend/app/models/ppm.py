from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class PPMSchedule(Base):
    """Planned Preventative Maintenance schedule entry."""
    __tablename__ = "ppm_schedules"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)  # None = whole property
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    frequency = Column(String, nullable=False)  # weekly, monthly, quarterly, biannual, annual
    next_due = Column(Date, nullable=False)
    last_triggered = Column(Date, nullable=True)
    contractor_id = Column(Integer, ForeignKey("contractors.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
