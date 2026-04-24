from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


SCHEMES = ["TDS", "DPS", "MyDeposits", "Other"]
STATUSES = ["unprotected", "protected", "pi_served", "returned", "disputed"]


class TenancyDeposit(Base):
    __tablename__ = "tenancy_deposits"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    lease_id = Column(Integer, ForeignKey("leases.id"), nullable=False, unique=True)
    amount = Column(Float, nullable=False)
    scheme = Column(String, nullable=True)           # TDS / DPS / MyDeposits / Other
    scheme_reference = Column(String, nullable=True)
    received_date = Column(Date, nullable=False)     # when deposit was received
    protected_date = Column(Date, nullable=True)     # when registered with scheme
    prescribed_info_date = Column(Date, nullable=True)  # when PI served to tenant
    status = Column(String, default="unprotected")   # unprotected/protected/pi_served/returned/disputed
    return_amount = Column(Float, nullable=True)
    deductions = Column(Float, nullable=True)
    deduction_reason = Column(String, nullable=True)
    returned_date = Column(Date, nullable=True)
    dispute_notes = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    checkin_inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=True)
    checkout_inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lease = relationship("Lease", backref="deposit_record")
    checkin_inspection = relationship("Inspection", foreign_keys=[checkin_inspection_id])
    checkout_inspection = relationship("Inspection", foreign_keys=[checkout_inspection_id])
