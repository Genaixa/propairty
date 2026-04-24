from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class LegalNotice(Base):
    __tablename__ = "legal_notices"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    lease_id = Column(Integer, ForeignKey("leases.id"), nullable=False)
    notice_type = Column(String, nullable=False)    # section_21 | section_8
    served_date = Column(Date, nullable=False)
    possession_date = Column(Date, nullable=True)   # S21 — date possession required
    court_date = Column(Date, nullable=True)        # S8 — earliest court date
    arrears_amount = Column(Float, nullable=True)   # S8
    custom_notes = Column(Text, nullable=True)
    # Pre-flight check results (stored as JSON-like flags)
    check_gas_cert = Column(String, nullable=True)   # pass | fail | n/a
    check_epc = Column(String, nullable=True)
    check_deposit = Column(String, nullable=True)
    check_how_to_rent = Column(String, nullable=True)
    viewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lease = relationship("Lease")
