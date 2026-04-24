import uuid
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class SavedSearch(Base):
    __tablename__ = "public_saved_searches"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    email = Column(String, nullable=False)
    label = Column(String, nullable=True)          # e.g. "2-bed Gateshead"
    filters_json = Column(Text, nullable=True)     # JSON blob of active filter state
    token = Column(String, unique=True, default=lambda: uuid.uuid4().hex)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
