from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Text
from sqlalchemy.sql import func
from app.database import Base

class MeterReading(Base):
    __tablename__ = "meter_readings"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    meter_type = Column(String, nullable=False)   # electricity, gas, water
    reading = Column(Float, nullable=False)
    reading_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    submitted_by = Column(String, default="tenant")  # tenant or agent
    created_at = Column(DateTime(timezone=True), server_default=func.now())
