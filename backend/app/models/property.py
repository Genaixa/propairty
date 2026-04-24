from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    landlord_id = Column(Integer, ForeignKey("landlords.id"), nullable=True)
    name = Column(String, nullable=False)
    address_line1 = Column(String, nullable=False)
    address_line2 = Column(String, nullable=True)
    city = Column(String, nullable=False)
    postcode = Column(String, nullable=False)
    property_type = Column(String, default="residential")  # residential, commercial, HMO
    description = Column(Text, nullable=True)
    epc_rating = Column(String(1), nullable=True)   # A-G
    epc_potential = Column(String(1), nullable=True) # A-G potential after improvements
    tenure = Column(String, nullable=True)           # Freehold, Leasehold, Share of Freehold
    features = Column(Text, nullable=True)            # Newline-separated key features
    virtual_tour_url = Column(String, nullable=True)  # URL to Matterport/YouTube tour
    council_tax_band = Column(String(1), nullable=True) # A-H
    bills_included = Column(Boolean, default=False, nullable=True)
    featured = Column(Boolean, default=False, nullable=True)   # show prominently on public listings site
    reference_number = Column(String(50), nullable=True)
    emergency_contacts = Column(Text, nullable=True)  # JSON: [{role, name, phone}]
    utility_info = Column(Text, nullable=True)         # JSON: {electricity, gas, water, council, bin_days, meter_elec, meter_gas}
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation", back_populates="properties")
    landlord = relationship("Landlord", back_populates="properties")
    units = relationship("Unit", back_populates="property", cascade="all, delete-orphan")
