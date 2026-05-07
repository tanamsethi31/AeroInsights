from __future__ import annotations

from typing import Optional

import httpx
import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models import User, UserRole

log = structlog.get_logger()

# auto_error=False so the dev bypass works without requiring an Authorization
# header.  Missing credentials in non-bypass mode are caught inside verify_token.
bearer_scheme = HTTPBearer(auto_error=False)

# Cache JWKS in memory (refreshed every 24h in production via background task)
_jwks: Optional[dict] = None

# ── Dev bypass identity ───────────────────────────────────────────────────────
# Matches auth0_sub set on USR-001 in the seed script.
_DEV_AUTH0_SUB = "dev|usr-001"


async def _get_jwks() -> dict:
    global _jwks
    if _jwks is None:
        url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10)
            resp.raise_for_status()
            _jwks = resp.json()
    return _jwks


class TokenPayload(BaseModel):
    sub: str
    tenant_id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


async def verify_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> TokenPayload:
    # ── Dev bypass (ENVIRONMENT=local + DEV_AUTH_BYPASS=true only) ──────────
    if settings.ENVIRONMENT == "local" and settings.DEV_AUTH_BYPASS:
        log.debug("dev_auth_bypass_active")
        return TokenPayload(
            sub=_DEV_AUTH0_SUB,
            tenant_id="demo-tenant-0001",
            email="john@aerinsights.com",
            role="admin",
        )

    # ── Normal JWT path ───────────────────────────────────────────────────────
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        jwks = await _get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = next(
            (k for k in jwks["keys"] if k.get("kid") == unverified_header.get("kid")),
            None,
        )
        if rsa_key is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid key")

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=settings.AUTH0_ALGORITHMS,
            audience=settings.AUTH0_AUDIENCE,
            issuer=f"https://{settings.AUTH0_DOMAIN}/",
        )
        return TokenPayload(**payload)

    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except JWTError as exc:
        log.warning("jwt_error", error=str(exc))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    payload: TokenPayload = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(select(User).where(User.auth0_sub == payload.sub))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


# ── Role guards ───────────────────────────────────────────────────────────────

def require_roles(*roles: UserRole):
    """Dependency factory that enforces one of the specified roles."""
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action.",
            )
        return user
    return _check


require_admin = require_roles(UserRole.admin)
require_risk_or_above = require_roles(UserRole.admin, UserRole.risk, UserRole.accounting)
require_write = require_roles(UserRole.admin, UserRole.risk, UserRole.accounting)
require_any = Depends(get_current_user)
