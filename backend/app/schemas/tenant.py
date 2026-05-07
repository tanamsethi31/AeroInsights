from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class TenantOut(BaseModel):
    id: str
    name: str
    primary_currency: str
    timezone: str
    fiscal_year_end: str
    ifrs9_adoption_date: Optional[date]
    default_discount_rate: Decimal
    model_config = {"from_attributes": True}


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    primary_currency: Optional[str] = None
    timezone: Optional[str] = None
    fiscal_year_end: Optional[str] = None
    ifrs9_adoption_date: Optional[date] = None
    default_discount_rate: Optional[Decimal] = None
