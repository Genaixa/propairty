from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="agent")  # admin | manager | negotiator | accounts | read_only
    restrict_to_assigned = Column(Boolean, default=False)  # if True, only sees assigned properties
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    invite_token = Column(Text, nullable=True, unique=True)
    invite_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation", back_populates="users")
