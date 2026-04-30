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
    epc_rating: Optional[str] = None
    epc_potential: Optional[str] = None
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
    epc_rating: Optional[str] = None
    epc_potential: Optional[str] = None
    tenure: Optional[str] = None
    features: Optional[str] = None
    virtual_tour_url: Optional[str] = None
    council_tax_band: Optional[str] = None
    bills_included: Optional[bool] = False
    featured: Optional[bool] = False
    reference_number: Optional[str] = None
    emergency_contacts: Optional[str] = None
    utility_info: Optional[str] = None

class PropertyCreate(PropertyBase):
    landlord_id: Optional[int] = None

class PropertyOut(PropertyBase):
    id: int
    organisation_id: int
    created_at: datetime
    units: List[UnitOut] = []
    class Config:
        from_attributes = True
