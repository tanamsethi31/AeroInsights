from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import Lease, User
from app.schemas.lease import LeaseCreate, LeaseOut, LeaseUpdate
from app.schemas.pagination import Page

router = APIRouter()


@router.get("", response_model=Page[LeaseOut])
async def list_leases(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    stage: str | None = None,
    lessee_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[LeaseOut]:
    q = select(Lease).where(Lease.tenant_id == current_user.tenant_id)
    if stage:
        q = q.where(Lease.stage == stage)
    if lessee_id:
        q = q.where(Lease.lessee_id == lessee_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)


@router.get("/{lease_id}", response_model=LeaseOut)
async def get_lease(
    lease_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Lease:
    result = await db.execute(
        select(Lease).where(Lease.id == lease_id, Lease.tenant_id == current_user.tenant_id)
    )
    lease = result.scalar_one_or_none()
    if lease is None:
        raise HTTPException(status_code=404, detail="Lease not found")
    return lease


@router.post("", response_model=LeaseOut, status_code=201)
async def create_lease(
    payload: LeaseCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> Lease:
    lease = Lease(**payload.model_dump(), tenant_id=current_user.tenant_id)
    db.add(lease)
    await db.flush()
    return lease


@router.patch("/{lease_id}", response_model=LeaseOut)
async def update_lease(
    lease_id: str,
    payload: LeaseUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> Lease:
    result = await db.execute(
        select(Lease).where(Lease.id == lease_id, Lease.tenant_id == current_user.tenant_id)
    )
    lease = result.scalar_one_or_none()
    if lease is None:
        raise HTTPException(status_code=404, detail="Lease not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lease, field, value)
    await db.flush()
    return lease
