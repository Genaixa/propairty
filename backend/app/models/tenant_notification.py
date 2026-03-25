from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class TenantNotification(Base):
    __tablename__ = "tenant_notifications"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="info")  # info, warning, urgent, success
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant", back_populates="notifications")
