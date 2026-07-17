"""FastAPI application entry point.

Run in development with:
    uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown hooks. The engine is disposed on shutdown so
    connections are released cleanly (important for --reload and deploys)."""
    logger.info("Starting %s (env=%s)", settings.app_name, settings.app_env)
    yield
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="AI Chat Dashboard API — multi-turn chat with personas.",
    lifespan=lifespan,
)

# CORS: the React dev server (and later the deployed frontend) must be allowed
# to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """Friendly landing response so hitting the base URL isn't a 404."""
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/api/health",
    }
