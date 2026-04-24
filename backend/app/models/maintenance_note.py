from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MaintenanceNote(Base):
    __tablename__ = "maintenance_notes"

    id = Column(Integer, primary_key=True, index=True)
    maintenance_request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    author_type = Column(String, nullable=False)   # "agent" | "contractor"
    author_name = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
