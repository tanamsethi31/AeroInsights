from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class PaymentOut(BaseModel):
    id: str
    lease_id: str
    due_date: date
    paid_date: Optional[date]
    amount_usd: Decimal
    days_late: int
    created_at: datetime
    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    due_date: date
    paid_date: Optional[date] = None
    amount_usd: Decimal
    days_late: int = 0
