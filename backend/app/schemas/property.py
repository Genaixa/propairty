from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UnitBase(BaseModel):
    name: str
    bedrooms: int = 1
    bathrooms: int = 1
    monthly_rent: float
    status: str = "vacant"

class UnitCreate(UnitBase):
    pass

class UnitOut(UnitBase):
    id: int
    property_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class PropertyBase(BaseModel):
    name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    postcode: str
    property_type: str = "residential"
    description: Optional[str] = None

class PropertyCreate(PropertyBase):
    pass

class PropertyOut(PropertyBase):
    id: int
    organisation_id: int
    created_at: datetime
    units: List[UnitOut] = []
    class Config:
        from_attributes = True
