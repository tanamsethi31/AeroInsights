from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import AlertRule, Alert, User
from app.schemas.alerts import (
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    AlertOut,
    AlertMarkRead,
)
from app.schemas.pagination import Page

router = APIRouter()


# ── Alert Rules ───────────────────────────────────────────────────────────────

@router.get("/rules", response_model=list[AlertRuleOut])
async def list_alert_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlertRule]:
    result = await db.execute(
        select(AlertRule).where(AlertRule.tenant_id == current_user.tenant_id)
    )
    return list(result.scalars().all())


@router.post("/rules", response_model=AlertRuleOut, status_code=201)
async def create_alert_rule(
    payload: AlertRuleCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> AlertRule:
    rule = AlertRule(**payload.model_dump(), tenant_id=current_user.tenant_id)
    db.add(rule)
    await db.flush()
    return rule


@router.patch("/rules/{rule_id}", response_model=AlertRuleOut)
async def update_alert_rule(
    rule_id: str,
    payload: AlertRuleUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> AlertRule:
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.id == rule_id,
            AlertRule.tenant_id == current_user.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    await db.flush()
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    rule_id: str,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.id == rule_id,
            AlertRule.tenant_id == current_user.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    await db.delete(rule)


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("", response_model=Page[AlertOut])
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[AlertOut]:
    q = (
        select(Alert)
        .where(Alert.tenant_id == current_user.tenant_id)
        .order_by(Alert.created_at.desc())
    )
    if unread_only:
        q = q.where(Alert.is_read.is_(False))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    count = (
        await db.execute(
            select(func.count()).where(
                Alert.tenant_id == current_user.tenant_id,
                Alert.is_read.is_(False),
            )
        )
    ).scalar_one()
    return {"count": count}


@router.post("/mark-read", status_code=200)
async def mark_alerts_read(
    payload: AlertMarkRead,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        update(Alert)
        .where(
            Alert.id.in_(payload.alert_ids),
            Alert.tenant_id == current_user.tenant_id,
        )
        .values(is_read=True)
    )
    return {"updated": len(payload.alert_ids)}


@router.post("/mark-all-read", status_code=200)
async def mark_all_read(
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        update(Alert)
        .where(Alert.tenant_id == current_user.tenant_id, Alert.is_read.is_(False))
        .values(is_read=True)
    )
    return {"updated": result.rowcount}
