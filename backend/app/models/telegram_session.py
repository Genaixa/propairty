from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.database import Base


class TelegramInventorySession(Base):
    __tablename__ = "telegram_inventory_sessions"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(String, nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    lease_id = Column(Integer, ForeignKey("leases.id"), nullable=True)
    inv_type = Column(String, nullable=True)   # check_in | check_out
    state = Column(String, nullable=False, default="awaiting_lease")
    # states: awaiting_lease | awaiting_type | room_N | awaiting_meters | done

    current_room_index = Column(Integer, default=0)
    # room_plan: [{room_name, expected_items:[str], check_in_items:[{item_name,condition}]}]
    room_plan = Column(JSON, default=list)
    # rooms_data: completed rooms [{room_name, items:[{item_name,condition,notes}]}]
    rooms_data = Column(JSON, default=list)

    conducted_by = Column(String, nullable=True)
    meter_electric = Column(String, nullable=True)
    meter_gas = Column(String, nullable=True)
    meter_water = Column(String, nullable=True)
    keys_handed = Column(String, nullable=True)

    draft_inventory_id = Column(Integer, ForeignKey("inventories.id"), nullable=True)
    current_room_db_id = Column(Integer, ForeignKey("inventory_rooms.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
