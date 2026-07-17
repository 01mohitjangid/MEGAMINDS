from fastapi import APIRouter

from app.api.routes import auth, conversations, health, personas

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(personas.router)
api_router.include_router(conversations.router)
