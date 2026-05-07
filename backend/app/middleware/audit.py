from __future__ import annotations

import hashlib
import json
import time
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.database import AsyncSessionLocal
from app.models import AuditLog

log = structlog.get_logger()

# Routes that should NOT be individually audit-logged (noise)
_SKIP_AUDIT_METHODS = {"GET", "HEAD", "OPTIONS"}
_SKIP_AUDIT_PATHS = {"/health", "/api/v1/auth/me"}


class AuditMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start) * 1000)

        # Structured access log on every request
        log.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
            ip=request.client.host if request.client else None,
        )

        # Write audit entry for mutating operations
        if (
            request.method not in _SKIP_AUDIT_METHODS
            and request.url.path not in _SKIP_AUDIT_PATHS
            and response.status_code < 400
        ):
            await self._write_audit_entry(request, response)

        return response

    async def _write_audit_entry(self, request: Request, response: Response) -> None:
        try:
            # Extract user info from request state (set by auth dependency)
            user = getattr(request.state, "user", None)
            tenant_id = getattr(user, "tenant_id", None) if user else None
            user_id = getattr(user, "id", None) if user else None
            user_email = getattr(user, "email", None) if user else None

            action = f"{request.method} {request.url.path}"

            entry = AuditLog(
                tenant_id=tenant_id,
                user_id=user_id,
                user_email=user_email,
                action=action,
                ip_address=request.client.host if request.client else None,
                meta_json={"status": response.status_code},
            )

            async with AsyncSessionLocal() as session:
                session.add(entry)
                await session.commit()

        except Exception as exc:
            log.error("audit_write_failed", error=str(exc))
