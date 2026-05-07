from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import Payment, Lease, User
from app.schemas.payment import PaymentCreate, PaymentOut
from typing import List

router = APIRouter()


async def _get_lease(lease_id: str, tenant_id: str, db: AsyncSession) -> Lease:
    result = await db.execute(
        select(Lease).where(Lease.id == lease_id, Lease.tenant_id == tenant_id)
    )
    lease = result.scalar_one_or_none()
    if lease is None:
        raise HTTPException(status_code=404, detail="Lease not found")
    return lease


@router.get("", response_model=List[PaymentOut])
async def list_payments(
    lease_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Payment]:
    await _get_lease(lease_id, current_user.tenant_id, db)
    result = await db.execute(select(Payment).where(Payment.lease_id == lease_id))
    return list(result.scalars().all())


@router.post("", response_model=PaymentOut, status_code=201)
async def create_payment(
    lease_id: str,
    payload: PaymentCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> Payment:
    await _get_lease(lease_id, current_user.tenant_id, db)
    payment = Payment(**payload.model_dump(), lease_id=lease_id, tenant_id=current_user.tenant_id)
    db.add(payment)
    await db.flush()
    return payment
