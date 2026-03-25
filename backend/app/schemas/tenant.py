from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

class TenantBase(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None

class TenantCreate(TenantBase):
    pass

class TenantOut(TenantBase):
    id: int
    organisation_id: int
    created_at: datetime
    class Config:
        from_attributes = True
