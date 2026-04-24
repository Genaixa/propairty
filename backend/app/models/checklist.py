from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

CHECKLIST_TYPES = ['pre_showing', 'pre_move_in', 'inspection', 'custom']


class Checklist(Base):
    __tablename__ = "checklists"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    name = Column(String, nullable=False)
    checklist_type = Column(String, nullable=False, default='custom')
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("ChecklistItem", back_populates="checklist",
                         cascade="all, delete-orphan", order_by="ChecklistItem.position")
    property = relationship("Property")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("checklists.id", ondelete="CASCADE"), nullable=False)
    label = Column(String, nullable=False)
    position = Column(Integer, nullable=False, default=0)
    checked = Column(Boolean, nullable=False, default=False)
    checked_at = Column(DateTime(timezone=True), nullable=True)
    checked_by = Column(String, nullable=True)

    checklist = relationship("Checklist", back_populates="items")
