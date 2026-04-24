from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class LandlordReportView(Base):
    __tablename__ = "landlord_report_views"

    id = Column(Integer, primary_key=True)
    landlord_id = Column(Integer, ForeignKey("landlords.id"), nullable=False)
    report_month = Column(String, nullable=False)
    viewed_at = Column(DateTime(timezone=True), server_default=func.now())
