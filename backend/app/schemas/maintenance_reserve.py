from __future__ import annotations
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class MROut(BaseModel):
    id: str
    lease_id: str
    component: str
    rate_basis: str
    rate_amount: Decimal
    refundable: bool
    cap_rule: Optional[str]
    cumulative_balance: Decimal
    model_config = {"from_attributes": True}


class MRCreate(BaseModel):
    component: str
    rate_basis: str
    rate_amount: Decimal
    refundable: bool = True
    cap_rule: Optional[str] = None
    cumulative_balance: Decimal = Decimal("0")


class MRUpdate(BaseModel):
    rate_amount: Optional[Decimal] = None
    refundable: Optional[bool] = None
    cap_rule: Optional[str] = None
    cumulative_balance: Optional[Decimal] = None
