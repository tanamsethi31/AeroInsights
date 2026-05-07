from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AircraftOut(BaseModel):
    id: str
    tenant_id: str
    msn: str
    aircraft_type: str
    registration: Optional[str]
    vintage: Optional[int]
    created_at: datetime
    model_config = {"from_attributes": True}


class AircraftCreate(BaseModel):
    msn: str
    aircraft_type: str
    registration: Optional[str] = None
    vintage: Optional[int] = None


class AircraftUpdate(BaseModel):
    aircraft_type: Optional[str] = None
    registration: Optional[str] = None
    vintage: Optional[int] = None
