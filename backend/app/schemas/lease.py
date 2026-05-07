from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.models import LeaseStage, LeaseStatus


class LeaseOut(BaseModel):
    id: str
    tenant_id: str
    lessee_id: str
    aircraft_id: str
    lease_start: date
    lease_end: date
    monthly_rent_usd: Decimal
    stage: LeaseStage
    status: LeaseStatus
    sicr_trigger: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class LeaseCreate(BaseModel):
    lessee_id: str
    aircraft_id: str
    lease_start: date
    lease_end: date
    monthly_rent_usd: Decimal
    stage: LeaseStage = LeaseStage.stage1
    status: LeaseStatus = LeaseStatus.active


class LeaseUpdate(BaseModel):
    lease_start: Optional[date] = None
    lease_end: Optional[date] = None
    monthly_rent_usd: Optional[Decimal] = None
    stage: Optional[LeaseStage] = None
    status: Optional[LeaseStatus] = None
    sicr_trigger: Optional[str] = None
