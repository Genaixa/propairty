from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class RentPayment(Base):
    __tablename__ = "rent_payments"
    __table_args__ = (
        UniqueConstraint("lease_id", "due_date", name="uq_rent_payments_lease_due"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lease_id = Column(Integer, ForeignKey("leases.id"), nullable=False)
    due_date = Column(Date, nullable=False)
    amount_due = Column(Float, nullable=False)
    amount_paid = Column(Float, nullable=True)
    paid_date = Column(Date, nullable=True)
    status = Column(String, default="pending")  # pending, paid, overdue, partial
    notes = Column(String, nullable=True)
    stripe_session_id = Column(String, nullable=True)
    last_reminder_sent = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lease = relationship("Lease", back_populates="payments")
