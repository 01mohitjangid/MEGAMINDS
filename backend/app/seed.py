"""Seed the built-in default personas.

Idempotent: run it as many times as you like — existing defaults (matched by
name, user_id IS NULL) are left untouched, missing ones are inserted.

    python -m app.seed
"""

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.persona import Persona

DEFAULT_PERSONAS: list[dict[str, str]] = [
    {
        "name": "Assistant",
        "description": "A helpful, balanced general-purpose assistant.",
        "system_prompt": (
            "You are a helpful, friendly assistant. Answer clearly and concisely."
        ),
    },
    {
        "name": "Code Mentor",
        "description": "A patient senior engineer who explains as they go.",
        "system_prompt": (
            "You are a senior software engineer mentoring a colleague. Explain your "
            "reasoning, suggest best practices, and include short code examples."
        ),
    },
    {
        "name": "Brainstormer",
        "description": "A creative partner for ideas and lateral thinking.",
        "system_prompt": (
            "You are an energetic brainstorming partner. Offer many diverse ideas, "
            "build on the user's thoughts, and stay upbeat and imaginative."
        ),
    },
]


async def seed_personas() -> int:
    """Insert any missing default personas. Returns how many were added."""
    added = 0
    async with AsyncSessionLocal() as db:
        for data in DEFAULT_PERSONAS:
            exists = await db.execute(
                select(Persona.id).where(
                    Persona.name == data["name"], Persona.user_id.is_(None)
                )
            )
            if exists.scalar_one_or_none() is not None:
                continue
            db.add(Persona(**data))
            added += 1
        await db.commit()
    return added


async def _main() -> None:
    added = await seed_personas()
    print(f"Seed complete — {added} persona(s) added.")


if __name__ == "__main__":
    asyncio.run(_main())
