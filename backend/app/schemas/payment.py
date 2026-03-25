from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

class PaymentOut(BaseModel):
    id: int
    lease_id: int
    due_date: date
    amount_due: float
    amount_paid: Optional[float] = None
    paid_date: Optional[date] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class MarkPaidRequest(BaseModel):
    amount_paid: float
    paid_date: date
    notes: Optional[str] = None
