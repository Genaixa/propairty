from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Lease(Base):
    __tablename__ = "leases"

    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    monthly_rent = Column(Float, nullable=False)
    deposit = Column(Float, nullable=True)
    status = Column(String, default="active")  # active, expired, terminated
    rent_day = Column(Integer, default=1)  # day of month rent is due
    is_periodic = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    unit = relationship("Unit", back_populates="leases")
    tenant = relationship("Tenant", back_populates="leases")
    renewals = relationship("LeaseRenewal", back_populates="lease", cascade="all, delete-orphan", order_by="LeaseRenewal.sent_at.desc()")
    payments = relationship("RentPayment", back_populates="lease", cascade="all, delete-orphan")
