from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False, index=True)
    user_id = Column(Integer, nullable=True)
    user_name = Column(String, nullable=True)
    action = Column(String, nullable=False)          # created | updated | deleted | viewed | sent
    entity_type = Column(String, nullable=False)     # tenant | property | lease | payment | maintenance | etc.
    entity_id = Column(Integer, nullable=True)
    entity_name = Column(String, nullable=True)      # human-readable label
    detail = Column(Text, nullable=True)             # free-text summary of what changed
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
