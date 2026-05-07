from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models import AuditLog, User
from app.schemas.audit import AuditLogOut
from app.schemas.pagination import Page

router = APIRouter()


@router.get("", response_model=Page[AuditLogOut])
async def list_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_email: str | None = None,
    action: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[AuditLogOut]:
    q = select(AuditLog).where(AuditLog.tenant_id == current_user.tenant_id).order_by(
        AuditLog.timestamp.desc()
    )
    if user_email:
        q = q.where(AuditLog.user_email.ilike(f"%{user_email}%"))
    if action:
        q = q.where(AuditLog.action.ilike(f"%{action}%"))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)
