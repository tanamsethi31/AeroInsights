from __future__ import annotations

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import TokenPayload, get_current_user, verify_token
from app.core.database import get_db
from app.models import User
from app.schemas.user import MeSyncRequest, UserOut

log = structlog.get_logger()
router = APIRouter()


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated user profile."""
    return current_user


@router.post("/me", response_model=UserOut)
async def sync_me(
    body: MeSyncRequest,
    payload: TokenPayload = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Provision or sync the authenticated user on first login.

    - If the user already exists (matched by auth0_sub): update last_login and return.
    - If a pre-provisioned user with the same email exists: link their auth0_sub,
      update last_login, and return.
    - If no match is found: 404 — this is a B2B product; users must be pre-provisioned
      by an administrator.
    """
    now = datetime.now(timezone.utc)

    # 1. Exact match on auth0_sub (returning user)
    result = await db.execute(select(User).where(User.auth0_sub == payload.sub))
    user = result.scalar_one_or_none()

    if user:
        user.last_login = now
        await db.commit()
        await db.refresh(user)
        log.info("user_login", user_id=user.id, email=user.email)
        return user

    # 2. Pre-provisioned user matched by email (first real login)
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact your administrator.",
            )
        user.auth0_sub = payload.sub
        user.last_login = now
        # Freshen display name from the IdP if it differs
        if body.name and body.name != user.name:
            user.name = body.name
        await db.commit()
        await db.refresh(user)
        log.info("user_first_login_linked", user_id=user.id, email=user.email, sub=payload.sub)
        return user

    # 3. Unknown user — no self-signup in this product
    log.warning("user_not_found_on_sync", sub=payload.sub, email=body.email)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No account found for this identity. Contact your administrator to be provisioned.",
    )
