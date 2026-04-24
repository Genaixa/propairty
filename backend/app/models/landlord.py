from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Landlord(Base):
    __tablename__ = "landlords"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    portal_enabled = Column(Boolean, default=False)
    avatar_url = Column(String, nullable=True)
    # Address
    address_line1 = Column(String, nullable=True)
    address_line2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    postcode = Column(String, nullable=True)
    # Company
    company_name = Column(String, nullable=True)
    company_number = Column(String, nullable=True)
    vat_number = Column(String, nullable=True)
    # Bank details (for remittances)
    bank_name = Column(String, nullable=True)
    account_name = Column(String, nullable=True)
    sort_code = Column(String, nullable=True)
    account_number = Column(String, nullable=True)
    # Management fee
    management_fee_pct = Column(Float, nullable=True)  # None = use org default (10%)
    # Notes
    notes = Column(String, nullable=True)
    # WhatsApp / notification prefs
    whatsapp_number = Column(String, nullable=True)
    notify_email = Column(Boolean, default=False)
    notify_whatsapp = Column(Boolean, default=False)
    notify_telegram = Column(Boolean, default=False)
    telegram_chat_id = Column(String, nullable=True)
    telegram_link_code = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation", back_populates="landlords")
    properties = relationship("Property", back_populates="landlord")
