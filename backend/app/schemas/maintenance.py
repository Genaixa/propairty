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
    reported_by_tenant_id: Optional[int] = None
    contractor_id: Optional[int] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    invoice_ref: Optional[str] = None

class MaintenanceOut(MaintenanceBase):
    id: int
    reported_by_tenant_id: Optional[int] = None
    contractor_id: Optional[int] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    invoice_ref: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True
