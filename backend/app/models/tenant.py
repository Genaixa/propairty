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
    hashed_password = Column(String, nullable=True)
    portal_enabled = Column(Boolean, default=False)
    whatsapp_number = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    leases = relationship("Lease", back_populates="tenant")
    notifications = relationship("TenantNotification", back_populates="tenant", cascade="all, delete-orphan")
