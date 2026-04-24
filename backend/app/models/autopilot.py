from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database import Base


class AutopilotConfig(Base):
    __tablename__ = "autopilot_config"

    id = Column(Integer, primary_key=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False, unique=True)
    enabled = Column(Boolean, nullable=False, default=False)
    checks = Column(JSONB, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AutopilotLog(Base):
    __tablename__ = "autopilot_log"

    id = Column(Integer, primary_key=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    check_type = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)
    recipient_label = Column(String, nullable=True)
    summary = Column(Text, nullable=False)
    message_sent = Column(Text, nullable=True)
    dedup_key = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
