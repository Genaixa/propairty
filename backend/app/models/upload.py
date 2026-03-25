from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    # Entity it's attached to (polymorphic via type + id)
    entity_type = Column(String, nullable=False)  # property, tenant, lease, inspection, maintenance
    entity_id = Column(Integer, nullable=False)
    # File info
    filename = Column(String, nullable=False)       # stored filename (uuid-based)
    original_name = Column(String, nullable=False)  # original upload name
    mime_type = Column(String, nullable=True)
    file_size = Column(BigInteger, nullable=True)   # bytes
    category = Column(String, nullable=True)        # certificate, agreement, photo, invoice, correspondence, other
    description = Column(String, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
