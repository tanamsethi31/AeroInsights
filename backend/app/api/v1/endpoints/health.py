from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("")
async def health_detail() -> dict:
    return {
        "status": "ok",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
