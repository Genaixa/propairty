from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MaintenanceBase(BaseModel):
    unit_id: int
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    status: str = "open"
    reported_by: Optional[str] = None
    assigned_to: Optional[str] = None

class MaintenanceCreate(MaintenanceBase):
    pass

class MaintenanceOut(MaintenanceBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True
