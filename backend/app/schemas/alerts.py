from __future__ import annotations

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel

from app.models import AlertRuleType, AlertSeverity


# ── Alert Rule schemas ────────────────────────────────────────────────────────

class AlertRuleOut(BaseModel):
    id: str
    tenant_id: str
    rule_type: AlertRuleType
    is_enabled: bool
    threshold_json: dict[str, Any]
    label: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AlertRuleCreate(BaseModel):
    rule_type: AlertRuleType
    is_enabled: bool = True
    threshold_json: dict[str, Any] = {}
    label: str
    description: Optional[str] = None


class AlertRuleUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    threshold_json: Optional[dict[str, Any]] = None
    label: Optional[str] = None
    description: Optional[str] = None


# ── Alert schemas ─────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: str
    tenant_id: str
    rule_id: str
    severity: AlertSeverity
    title: str
    body: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class AlertMarkRead(BaseModel):
    alert_ids: list[str]
