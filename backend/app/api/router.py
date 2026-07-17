"""Aggregate API router.

Every feature module registers its routes here, and `main.py` mounts this one
router under the `/api` prefix. Adding a new feature = one import + one include.
"""

from fastapi import APIRouter

from app.api.routes import auth, conversations, health, personas

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(personas.router)
api_router.include_router(conversations.router)
