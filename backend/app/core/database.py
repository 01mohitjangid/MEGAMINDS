"""Async database layer.

Uses SQLAlchemy 2.0's async engine with the psycopg3 driver. Models (added in
Phase 2) inherit from `Base`; request handlers get a session via the
`get_db` FastAPI dependency, which guarantees the session is closed after use.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# echo=True in development gives helpful SQL logging; silenced in production.
engine = create_async_engine(
    settings.database_url,
    echo=not settings.is_production,
    pool_pre_ping=True,  # transparently recycle dropped connections
    # `prepare_threshold=None` disables psycopg3 server-side prepared statements.
    # Neon (and most serverless Postgres) sit behind a pgbouncer-style pooler in
    # transaction mode, where prepared statements leak across connections and
    # raise "prepared statement already exists". Disabling them keeps us safe on
    # pooled connections both locally and in production.
    connect_args={"prepare_threshold": None},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Declarative base class for all ORM models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a scoped async session."""
    async with AsyncSessionLocal() as session:
        yield session
