from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Date, Numeric
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
    amenities = Column(Text, nullable=True)  # JSON list of amenity keys
    rooms = Column(Text, nullable=True)      # JSON list of {type, label, size_sqm}
    occupancy_type = Column(String, nullable=True)   # single, couple, family, sharers, students, corporate
    max_occupants = Column(Integer, nullable=True)
    occupancy_notes = Column(Text, nullable=True)
    date_listed = Column(Date, nullable=True)           # when first listed publicly
    previous_rent = Column(Numeric(10, 2), nullable=True)  # for "Reduced" badge
    reception_rooms = Column(Integer, default=0)
    available_from = Column(Date, nullable=True)        # availability date
    furnished = Column(String, nullable=True)            # furnished | unfurnished | part-furnished
    deposit_weeks = Column(Integer, default=5)          # weeks of rent as deposit (5-week cap)
    epc_rating = Column(String(1), nullable=True)        # A-G, overrides property-level EPC for this unit
    epc_potential = Column(String(1), nullable=True)     # A-G potential after improvements
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    property = relationship("Property", back_populates="units")
    leases = relationship("Lease", back_populates="unit", cascade="all, delete-orphan")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="unit", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="unit", cascade="all, delete-orphan")
