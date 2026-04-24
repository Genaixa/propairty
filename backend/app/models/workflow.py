from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


TRIGGERS = [
    "rent_overdue",          # email tenant N days after due date
    "lease_expiring",        # email tenant N days before end
    "maintenance_stale",     # telegram/email N days after open
    "viewing_reminder",      # email applicant N hours before viewing
    "inspection_upcoming",   # email tenant N days before inspection
    "ppm_due",               # telegram N days before PPM due
    "deposit_unprotected",   # telegram N days after received
]

ACTIONS = [
    "email_tenant",
    "email_landlord",
    "telegram_agent",
]


class WorkflowRule(Base):
    __tablename__ = "workflow_rules"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    name = Column(String, nullable=False)
    trigger = Column(String, nullable=False)
    trigger_days = Column(Integer, nullable=False, default=7)
    action = Column(String, nullable=False, default="telegram_agent")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
