from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import MaintenanceReserve, Lease, User
from app.schemas.maintenance_reserve import MRCreate, MROut, MRUpdate

router = APIRouter()


async def _get_lease(lease_id: str, tenant_id: str, db: AsyncSession) -> Lease:
    result = await db.execute(
        select(Lease).where(Lease.id == lease_id, Lease.tenant_id == tenant_id)
    )
    lease = result.scalar_one_or_none()
    if lease is None:
        raise HTTPException(status_code=404, detail="Lease not found")
    return lease


@router.get("", response_model=List[MROut])
async def list_mrs(
    lease_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MaintenanceReserve]:
    await _get_lease(lease_id, current_user.tenant_id, db)
    result = await db.execute(
        select(MaintenanceReserve).where(MaintenanceReserve.lease_id == lease_id)
    )
    return list(result.scalars().all())


@router.post("", response_model=MROut, status_code=201)
async def create_mr(
    lease_id: str,
    payload: MRCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> MaintenanceReserve:
    await _get_lease(lease_id, current_user.tenant_id, db)
    mr = MaintenanceReserve(**payload.model_dump(), lease_id=lease_id, tenant_id=current_user.tenant_id)
    db.add(mr)
    await db.flush()
    return mr


@router.patch("/{mr_id}", response_model=MROut)
async def update_mr(
    lease_id: str,
    mr_id: str,
    payload: MRUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> MaintenanceReserve:
    result = await db.execute(
        select(MaintenanceReserve).where(
            MaintenanceReserve.id == mr_id,
            MaintenanceReserve.lease_id == lease_id,
            MaintenanceReserve.tenant_id == current_user.tenant_id,
        )
    )
    mr = result.scalar_one_or_none()
    if mr is None:
        raise HTTPException(status_code=404, detail="MR not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(mr, f, v)
    await db.flush()
    return mr
