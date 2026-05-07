from __future__ import annotations
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel
from app.models import LeaseStage, WatchlistStatus


class LesseeOut(BaseModel):
    id: str
    tenant_id: str
    name: str
    country_code: str
    credit_rating: Optional[str]
    stage: LeaseStage
    watchlist_status: WatchlistStatus
    behavior_score: Optional[int]
    behavior_scores_json: Optional[dict[str, Any]]
    notes: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class LesseeCreate(BaseModel):
    name: str
    country_code: str
    credit_rating: Optional[str] = None
    stage: LeaseStage = LeaseStage.stage1
    notes: Optional[str] = None


class LesseeUpdate(BaseModel):
    name: Optional[str] = None
    country_code: Optional[str] = None
    credit_rating: Optional[str] = None
    stage: Optional[LeaseStage] = None
    watchlist_status: Optional[WatchlistStatus] = None
    behavior_score: Optional[int] = None
    notes: Optional[str] = None
