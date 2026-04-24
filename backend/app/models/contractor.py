from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Contractor(Base):
    __tablename__ = "contractors"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    full_name = Column(String, nullable=False)
    contact_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    trade = Column(String, nullable=True)  # plumber, electrician, gas engineer, etc.
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    portal_enabled = Column(Boolean, default=False)
    whatsapp_number = Column(String, nullable=True)
    notify_email = Column(Boolean, default=False)
    notify_whatsapp = Column(Boolean, default=False)
    notify_telegram = Column(Boolean, default=False)
    telegram_chat_id = Column(String, nullable=True)
    telegram_link_code = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    jobs = relationship("MaintenanceRequest", back_populates="contractor")
