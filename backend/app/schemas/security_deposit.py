from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.models import SDType


class SDOut(BaseModel):
    id: str
    lease_id: str
    sd_type: SDType
    amount: Decimal
    currency: str
    refund_triggers: Optional[str]
    governing_law: Optional[str]
    model_config = {"from_attributes": True}


class SDCreate(BaseModel):
    sd_type: SDType
    amount: Decimal
    currency: str = "USD"
    refund_triggers: Optional[str] = None
    governing_law: Optional[str] = None


class SDUpdate(BaseModel):
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    refund_triggers: Optional[str] = None
    governing_law: Optional[str] = None
