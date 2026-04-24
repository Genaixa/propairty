from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ContractorReview(Base):
    __tablename__ = "contractor_reviews"

    id = Column(Integer, primary_key=True, index=True)
    contractor_id = Column(Integer, ForeignKey("contractors.id"), nullable=False)
    maintenance_request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=True)
    reviewer_type = Column(String, nullable=False)   # "tenant" | "agent"
    reviewer_name = Column(String, nullable=False)
    stars = Column(Integer, nullable=False)           # 1–5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
