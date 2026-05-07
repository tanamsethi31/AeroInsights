from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import Valuation, Aircraft, User
from app.schemas.valuation import ValuationCreate, ValuationOut

router = APIRouter()


@router.get("", response_model=List[ValuationOut])
async def list_valuations(
    aircraft_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Valuation]:
    # Verify aircraft belongs to tenant
    result = await db.execute(
        select(Aircraft).where(Aircraft.id == aircraft_id, Aircraft.tenant_id == current_user.tenant_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    result2 = await db.execute(
        select(Valuation).where(Valuation.aircraft_id == aircraft_id).order_by(Valuation.as_of_date.desc())
    )
    return list(result2.scalars().all())


@router.post("", response_model=ValuationOut, status_code=201)
async def create_valuation(
    aircraft_id: str,
    payload: ValuationCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> Valuation:
    result = await db.execute(
        select(Aircraft).where(Aircraft.id == aircraft_id, Aircraft.tenant_id == current_user.tenant_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    val = Valuation(**payload.model_dump(), aircraft_id=aircraft_id, tenant_id=current_user.tenant_id)
    db.add(val)
    await db.flush()
    return val
