from __future__ import annotations
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: str
    tenant_id: Optional[str]
    user_id: Optional[str]
    user_email: Optional[str]
    timestamp: datetime
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    ip_address: Optional[str]
    meta_json: Optional[dict[str, Any]]
    model_config = {"from_attributes": True}
