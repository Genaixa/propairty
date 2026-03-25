from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Unit(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "Flat 1", "Ground Floor"
    bedrooms = Column(Integer, default=1)
    bathrooms = Column(Integer, default=1)
    monthly_rent = Column(Float, nullable=False)
    status = Column(String, default="vacant")  # vacant, occupied, maintenance
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    property = relationship("Property", back_populates="units")
    leases = relationship("Lease", back_populates="unit", cascade="all, delete-orphan")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="unit", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="unit", cascade="all, delete-orphan")
