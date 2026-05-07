from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models import UserRole


class UserOut(BaseModel):
    id: str
    tenant_id: str
    email: str
    name: str
    role: UserRole
    mfa_enabled: bool
    last_login: Optional[datetime]
    is_active: bool
    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.readonly
    mfa_enabled: bool = False


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    mfa_enabled: Optional[bool] = None
    is_active: Optional[bool] = None


class MeSyncRequest(BaseModel):
    email: EmailStr
    name: str
