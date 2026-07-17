"""Application configuration.

All settings are loaded from environment variables (or a local `.env` file)
via pydantic-settings, so nothing sensitive is ever hard-coded. Import the
singleton `settings` object anywhere it's needed.
"""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_name: str = "MegaMinds AI Chat Dashboard"
    app_env: str = "development"

    # CORS: accept a comma-separated string (from .env) or a real list.
    # NoDecode stops pydantic-settings from JSON-decoding the env value so our
    # validator below can split it on commas instead.
    backend_cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    # --- Database ---
    database_url: str = (
        "postgresql+psycopg://megaminds:megaminds@localhost:5433/megaminds"
    )

    # --- Auth (consumed from Phase 2) ---
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # --- AI provider (consumed from Phase 3) ---
    gemini_api_key: str = ""
    # gemini-flash-latest tracks Google's current free-tier flash model; the
    # older pinned "gemini-2.0-flash" now has a 0 free-tier quota (retired).
    gemini_model: str = "gemini-flash-latest"

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Allow BACKEND_CORS_ORIGINS to be a comma-separated env string."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("database_url", mode="after")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        """Force the async psycopg3 driver regardless of how the URL is written.

        Cloud providers (Neon, Supabase, Railway, …) hand out plain
        `postgresql://` (sometimes `postgres://`) URLs. Our async engine needs
        the `postgresql+psycopg://` form, so we upgrade the scheme here. This
        means you can paste a provider's connection string verbatim into .env
        and it just works — SSL params like `?sslmode=require` are preserved.
        """
        if value.startswith("postgresql+"):
            return value  # already has an explicit driver
        if value.startswith("postgres://"):
            return "postgresql+psycopg://" + value[len("postgres://") :]
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value[len("postgresql://") :]
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so the .env file is parsed only once per process."""
    return Settings()


settings = get_settings()
