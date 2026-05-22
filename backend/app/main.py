from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine, Base
from app.core.logging import configure_logging
from app.middleware.audit import AuditMiddleware

configure_logging()
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    log.info("startup", env=settings.ENVIRONMENT, version=settings.VERSION)
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    _local = settings.ENVIRONMENT == "local"
    app = FastAPI(
        title="Aeroinsights API",
        description="Aviation Lessor Decision Platform — Backend API",
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if _local else None,
        docs_url=f"{settings.API_V1_PREFIX}/docs" if _local else None,
        redoc_url=f"{settings.API_V1_PREFIX}/redoc" if _local else None,
        lifespan=lifespan,
    )

    # CORS — restrict to known origins, methods, and headers
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Audit logging middleware
    app.add_middleware(AuditMiddleware)

    # API routes
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok", "version": settings.VERSION}

    return app


app = create_app()
