from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    type = Column(String, nullable=False)  # routine, check_in, check_out, inventory
    status = Column(String, default="scheduled")  # scheduled, completed, cancelled
    scheduled_date = Column(Date, nullable=False)
    completed_date = Column(Date, nullable=True)
    inspector_name = Column(String, nullable=True)
    overall_condition = Column(String, nullable=True)  # excellent, good, fair, poor
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    unit = relationship("Unit", back_populates="inspections")
    rooms = relationship("InspectionRoom", back_populates="inspection", cascade="all, delete-orphan")


class InspectionRoom(Base):
    __tablename__ = "inspection_rooms"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    room_name = Column(String, nullable=False)  # Living Room, Kitchen, Bedroom 1, etc.
    condition = Column(String, nullable=True)  # excellent, good, fair, poor
    cleanliness = Column(String, nullable=True)  # clean, satisfactory, dirty
    notes = Column(Text, nullable=True)

    inspection = relationship("Inspection", back_populates="rooms")
