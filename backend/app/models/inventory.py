from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

CONDITIONS = ["excellent", "good", "fair", "poor", "missing", "n/a"]

DEFAULT_ROOMS = {
    "Living Room": ["Carpet/Flooring", "Walls", "Ceiling", "Light Fitting", "Curtains/Blinds", "Sockets & Switches", "Windows & Locks"],
    "Kitchen": ["Flooring", "Walls", "Worktops", "Sink & Taps", "Oven/Hob", "Extractor Fan", "Fridge/Freezer", "Cupboards & Drawers", "Sockets & Switches"],
    "Bedroom 1": ["Carpet/Flooring", "Walls", "Ceiling", "Light Fitting", "Curtains/Blinds", "Wardrobe", "Door & Lock", "Sockets & Switches"],
    "Bathroom": ["Floor", "Walls", "Bath/Shower", "Basin & Taps", "WC", "Mirror", "Towel Rail", "Extractor Fan"],
    "Hallway": ["Flooring", "Walls", "Front Door & Lock", "Letterbox", "Stairs (if applicable)"],
}


class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    lease_id = Column(Integer, ForeignKey("leases.id"), nullable=False)
    inv_type = Column(String, nullable=False)         # check_in | check_out
    inv_date = Column(Date, nullable=False)
    conducted_by = Column(String, nullable=True)
    tenant_present = Column(Boolean, default=True)
    overall_notes = Column(Text, nullable=True)
    meter_electric = Column(String, nullable=True)    # meter readings
    meter_gas = Column(String, nullable=True)
    meter_water = Column(String, nullable=True)
    keys_handed = Column(String, nullable=True)       # e.g. "2 front door, 1 postbox"
    status = Column(String, default="confirmed")   # confirmed | draft
    ack_token = Column(String, nullable=True, unique=True)
    ack_sent_at = Column(DateTime(timezone=True), nullable=True)
    tenant_acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lease = relationship("Lease")
    rooms = relationship("InventoryRoom", back_populates="inventory", cascade="all, delete-orphan", order_by="InventoryRoom.order")


class InventoryRoom(Base):
    __tablename__ = "inventory_rooms"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"), nullable=False)
    room_name = Column(String, nullable=False)
    order = Column(Integer, default=0)
    notes = Column(Text, nullable=True)

    inventory = relationship("Inventory", back_populates="rooms")
    items = relationship("InventoryItem", back_populates="room", cascade="all, delete-orphan", order_by="InventoryItem.order")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("inventory_rooms.id"), nullable=False)
    item_name = Column(String, nullable=False)
    condition = Column(String, nullable=True)         # excellent/good/fair/poor/missing/n/a
    notes = Column(Text, nullable=True)
    order = Column(Integer, default=0)

    room = relationship("InventoryRoom", back_populates="items")
