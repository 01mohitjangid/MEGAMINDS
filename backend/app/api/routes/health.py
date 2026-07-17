"""Health-check endpoints.

`/health` is a cheap liveness probe. `/health/db` additionally verifies the
database connection, which is what the frontend uses in Phase 1 to prove the
full stack is wired together.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health() -> dict[str, str]:
    """Liveness probe — returns OK if the API process is running."""
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}


@router.get("/db")
async def health_db(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Readiness probe — confirms the database is reachable."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
