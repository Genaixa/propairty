from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class PropertyValuation(Base):
    __tablename__ = "property_valuations"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    estimated_value = Column(Float, nullable=False)
    valuation_date = Column(Date, nullable=False)
    source = Column(String, nullable=True)   # manual, surveyor, zoopla, rightmove, other
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    property = relationship("Property")
