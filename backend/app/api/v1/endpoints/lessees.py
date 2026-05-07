from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import Lessee, User
from app.schemas.lessee import LesseeCreate, LesseeOut, LesseeUpdate
from app.schemas.pagination import Page

router = APIRouter()


@router.get("", response_model=Page[LesseeOut])
async def list_lessees(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    stage: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[LesseeOut]:
    q = select(Lessee).where(Lessee.tenant_id == current_user.tenant_id)
    if stage:
        q = q.where(Lessee.stage == stage)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)


@router.get("/{lessee_id}", response_model=LesseeOut)
async def get_lessee(
    lessee_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Lessee:
    result = await db.execute(
        select(Lessee).where(Lessee.id == lessee_id, Lessee.tenant_id == current_user.tenant_id)
    )
    lessee = result.scalar_one_or_none()
    if lessee is None:
        raise HTTPException(status_code=404, detail="Lessee not found")
    return lessee


@router.post("", response_model=LesseeOut, status_code=201)
async def create_lessee(
    payload: LesseeCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> Lessee:
    lessee = Lessee(**payload.model_dump(), tenant_id=current_user.tenant_id)
    db.add(lessee)
    await db.flush()
    return lessee


@router.patch("/{lessee_id}", response_model=LesseeOut)
async def update_lessee(
    lessee_id: str,
    payload: LesseeUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> Lessee:
    result = await db.execute(
        select(Lessee).where(Lessee.id == lessee_id, Lessee.tenant_id == current_user.tenant_id)
    )
    lessee = result.scalar_one_or_none()
    if lessee is None:
        raise HTTPException(status_code=404, detail="Lessee not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lessee, field, value)
    await db.flush()
    return lessee
