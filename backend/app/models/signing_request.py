from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class SigningRequest(Base):
    __tablename__ = "signing_requests"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=True)
    token = Column(String, unique=True, nullable=False, index=True)
    doc_type = Column(String, nullable=False)
    doc_label = Column(String, nullable=False)
    lease_id = Column(Integer, ForeignKey("leases.id", ondelete="SET NULL"), nullable=True)
    signer_name = Column(String, nullable=False)
    signer_email = Column(String, nullable=False)
    signer_type = Column(String, nullable=False, default="tenant")  # tenant | landlord | other
    status = Column(String, nullable=False, default="pending")      # pending | signed | declined | expired
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    declined_at = Column(DateTime(timezone=True), nullable=True)
    signature_data = Column(Text, nullable=True)   # base64 PNG data URL
    signed_pdf_path = Column(String, nullable=True) # path to final signed PDF
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    doc_params = Column(Text, nullable=True)        # JSON extra params (new_rent, arrears_amount etc.)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
