from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class PropertyEpcRoadmap(Base):
    __tablename__ = "property_epc_roadmaps"
    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    epc_rating = Column(String(1), nullable=False)
    target_date = Column(String, nullable=True)  # ISO date string
    improvements_json = Column(Text, nullable=False)  # JSON array of improvements
    property_name = Column(String, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
