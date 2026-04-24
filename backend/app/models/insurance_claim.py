from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base


class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    claim_reference = Column(String, nullable=True)
    claim_type = Column(String, nullable=False)
    incident_date = Column(String, nullable=False)
    incident_description = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    damage_description = Column(Text, nullable=True)
    estimated_claim_min = Column(Integer, nullable=True)
    estimated_claim_max = Column(Integer, nullable=True)
    timeline = Column(JSON, nullable=True)
    next_steps = Column(JSON, nullable=True)
    supporting_documents_checklist = Column(JSON, nullable=True)
    pdf_filename = Column(String, nullable=True)
    status = Column(String, default="draft")   # draft, submitted, settled, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
