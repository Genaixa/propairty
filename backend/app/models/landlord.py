from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Landlord(Base):
    __tablename__ = "landlords"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation", back_populates="landlords")
    properties = relationship("Property", back_populates="landlord")
