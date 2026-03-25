from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

class LeaseBase(BaseModel):
    unit_id: int
    tenant_id: int
    start_date: date
    end_date: Optional[date] = None
    monthly_rent: float
    deposit: Optional[float] = None
    status: str = "active"
    rent_day: int = 1
    is_periodic: bool = False

class LeaseCreate(LeaseBase):
    pass

class LeaseOut(LeaseBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True
