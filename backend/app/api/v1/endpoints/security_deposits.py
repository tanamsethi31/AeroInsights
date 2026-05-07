from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import SecurityDeposit, Lease, User
from app.schemas.security_deposit import SDCreate, SDOut, SDUpdate

router = APIRouter()


async def _get_lease(lease_id: str, tenant_id: str, db: AsyncSession) -> Lease:
    result = await db.execute(
        select(Lease).where(Lease.id == lease_id, Lease.tenant_id == tenant_id)
    )
    lease = result.scalar_one_or_none()
    if lease is None:
        raise HTTPException(status_code=404, detail="Lease not found")
    return lease


@router.get("", response_model=List[SDOut])
async def list_sds(
    lease_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SecurityDeposit]:
    await _get_lease(lease_id, current_user.tenant_id, db)
    result = await db.execute(select(SecurityDeposit).where(SecurityDeposit.lease_id == lease_id))
    return list(result.scalars().all())


@router.post("", response_model=SDOut, status_code=201)
async def create_sd(
    lease_id: str,
    payload: SDCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> SecurityDeposit:
    await _get_lease(lease_id, current_user.tenant_id, db)
    sd = SecurityDeposit(**payload.model_dump(), lease_id=lease_id, tenant_id=current_user.tenant_id)
    db.add(sd)
    await db.flush()
    return sd


@router.patch("/{sd_id}", response_model=SDOut)
async def update_sd(
    lease_id: str,
    sd_id: str,
    payload: SDUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> SecurityDeposit:
    result = await db.execute(
        select(SecurityDeposit).where(
            SecurityDeposit.id == sd_id,
            SecurityDeposit.lease_id == lease_id,
            SecurityDeposit.tenant_id == current_user.tenant_id,
        )
    )
    sd = result.scalar_one_or_none()
    if sd is None:
        raise HTTPException(status_code=404, detail="Security deposit not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(sd, f, v)
    await db.flush()
    return sd
