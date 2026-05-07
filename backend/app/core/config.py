from __future__ import annotations

from typing import Literal

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # ── Application ──────────────────────────────────────────────────────────
    VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "change-me-in-production"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://aero:aero@localhost:5432/aeroinsights"

    # ── Redis / Celery ────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── Auth0 ─────────────────────────────────────────────────────────────────
    AUTH0_DOMAIN: str = "your-tenant.eu.auth0.com"
    AUTH0_AUDIENCE: str = "https://api.aeroinsights.io"
    AUTH0_ALGORITHMS: list[str] = ["RS256"]

    # ── Dev auth bypass ───────────────────────────────────────────────────────
    # When true AND ENVIRONMENT=local, all endpoints authenticate as the demo
    # admin user (USR-001) without requiring a real Auth0 JWT.
    # NEVER set this in staging or production.
    DEV_AUTH_BYPASS: bool = False

    # ── AWS ───────────────────────────────────────────────────────────────────
    AWS_REGION: str = "eu-west-1"
    AWS_S3_BUCKET: str = "aeroinsights-exports"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # ── Email (Postmark) ──────────────────────────────────────────────────────
    POSTMARK_API_TOKEN: str = ""
    EMAIL_FROM: str = "noreply@aeroinsights.io"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",   # Vite dev server
        "https://app.aeroinsights.io",
    ]

    # ── Pagination ────────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 500

    # ── Audit log retention ───────────────────────────────────────────────────
    AUDIT_RETENTION_YEARS: int = 7

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v


settings = Settings()
