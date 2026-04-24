from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MaintenanceSurvey(Base):
    __tablename__ = "maintenance_surveys"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    token = Column(String, unique=True, nullable=False, index=True)
    rating = Column(Integer, nullable=True)           # 1-5, null until responded
    comment = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)
