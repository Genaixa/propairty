from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint
from app.database import Base


class OrgFeatureFlag(Base):
    __tablename__ = "org_feature_flags"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    flag_key = Column(String, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)

    __table_args__ = (UniqueConstraint("organisation_id", "flag_key", name="uq_org_flag"),)
