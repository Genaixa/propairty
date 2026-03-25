from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation", back_populates="properties")
    landlord = relationship("Landlord", back_populates="properties")
    units = relationship("Unit", back_populates="property", cascade="all, delete-orphan")
