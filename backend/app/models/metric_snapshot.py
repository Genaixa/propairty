from sqlalchemy import Column, Integer, Date, JSON, UniqueConstraint
from app.database import Base


class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"
    id = Column(Integer, primary_key=True)
    organisation_id = Column(Integer, nullable=False, index=True)
    date = Column(Date, nullable=False)
    data = Column(JSON, nullable=False)
    __table_args__ = (UniqueConstraint("organisation_id", "date", name="uq_metric_snapshot_org_date"),)
