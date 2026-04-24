from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    notes = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    portal_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    whatsapp_number = Column(String, nullable=True)
    # Notification preferences
    notify_email = Column(Boolean, default=False)
    notify_whatsapp = Column(Boolean, default=False)
    notify_telegram = Column(Boolean, default=False)
    telegram_chat_id = Column(String, nullable=True)
    telegram_link_code = Column(String, nullable=True)
    # Right to Rent
    rtr_document_type = Column(String, nullable=True)   # passport, brp, visa, euss, unlimited
    rtr_check_date = Column(Date, nullable=True)
    rtr_expiry_date = Column(Date, nullable=True)       # None = no time limit (British/ILR)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    leases = relationship("Lease", back_populates="tenant")
    notifications = relationship("TenantNotification", back_populates="tenant", cascade="all, delete-orphan")
