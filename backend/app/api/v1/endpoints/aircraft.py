from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import Aircraft, User
from app.schemas.aircraft import AircraftCreate, AircraftOut, AircraftUpdate
from app.schemas.pagination import Page

router = APIRouter()


@router.get("", response_model=Page[AircraftOut])
async def list_aircraft(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[AircraftOut]:
    q = select(Aircraft).where(Aircraft.tenant_id == current_user.tenant_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)


@router.get("/{aircraft_id}", response_model=AircraftOut)
async def get_aircraft(
    aircraft_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Aircraft:
    result = await db.execute(
        select(Aircraft).where(Aircraft.id == aircraft_id, Aircraft.tenant_id == current_user.tenant_id)
    )
    ac = result.scalar_one_or_none()
    if ac is None:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    return ac


@router.post("", response_model=AircraftOut, status_code=201)
async def create_aircraft(
    payload: AircraftCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> Aircraft:
    ac = Aircraft(**payload.model_dump(), tenant_id=current_user.tenant_id)
    db.add(ac)
    await db.flush()
    return ac


@router.patch("/{aircraft_id}", response_model=AircraftOut)
async def update_aircraft(
    aircraft_id: str,
    payload: AircraftUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> Aircraft:
    result = await db.execute(
        select(Aircraft).where(Aircraft.id == aircraft_id, Aircraft.tenant_id == current_user.tenant_id)
    )
    ac = result.scalar_one_or_none()
    if ac is None:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ac, field, value)
    await db.flush()
    return ac
