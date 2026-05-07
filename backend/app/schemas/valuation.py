from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.models import ValuationSource


class ValuationOut(BaseModel):
    id: str
    aircraft_id: str
    source: ValuationSource
    half_life_base: Optional[Decimal]
    current_mv: Optional[Decimal]
    mav: Optional[Decimal]
    lease_encumbered: Optional[Decimal]
    part_out: Optional[Decimal]
    uncertainty_band_pct: Optional[Decimal]
    as_of_date: date
    created_at: datetime
    model_config = {"from_attributes": True}


class ValuationCreate(BaseModel):
    source: ValuationSource
    as_of_date: date
    half_life_base: Optional[Decimal] = None
    current_mv: Optional[Decimal] = None
    mav: Optional[Decimal] = None
    lease_encumbered: Optional[Decimal] = None
    part_out: Optional[Decimal] = None
    uncertainty_band_pct: Optional[Decimal] = None
