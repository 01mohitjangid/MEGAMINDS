"""Google Gemini integration.

The one place that talks to the AI. Routes hand us the persona's system prompt
and the ordered message history; we translate that into Gemini's request shape,
call the model asynchronously, and return the reply text.

Roles map: our ``user`` -> Gemini ``user``; our ``assistant`` -> Gemini
``model``. The persona's ``system_prompt`` becomes the system instruction, which
is what makes persona switching actually change behaviour.
"""

from collections.abc import AsyncIterator, Sequence

from google import genai
from google.genai import types

from app.core.config import settings

# "assistant" is our storage term; Gemini calls the model's turns "model".
_ROLE_MAP = {"user": "user", "assistant": "model"}


class AINotConfigured(Exception):
    """No GEMINI_API_KEY is set — the AI cannot be called."""


class AIRequestFailed(Exception):
    """Gemini returned an error or an empty response."""


# Build the client once. Without a key we stay None and raise a clean,
# actionable error instead of crashing at import time.
_client: genai.Client | None = (
    genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None
)


def is_configured() -> bool:
    """True if a Gemini API key was provided and the client is ready."""
    return _client is not None


def _to_contents(history: Sequence[tuple[str, str]]) -> list[types.Content]:
    """Map (role, content) rows -> Gemini Content list, skipping unknown roles."""
    contents: list[types.Content] = []
    for role, text in history:
        gemini_role = _ROLE_MAP.get(role)
        if gemini_role is None:
            continue
        contents.append(
            types.Content(role=gemini_role, parts=[types.Part.from_text(text=text)])
        )
    return contents


async def generate_reply(
    system_prompt: str | None,
    history: Sequence[tuple[str, str]],
) -> str:
    """Return the assistant's reply for a conversation.

    ``history`` is the full thread in chronological order, already including the
    user's newest message as the last item.
    """
    if _client is None:
        raise AINotConfigured

    config = types.GenerateContentConfig(
        system_instruction=system_prompt or None,
    )

    try:
        response = await _client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=_to_contents(history),
            config=config,
        )
    except Exception as exc:  # noqa: BLE001 — normalise any SDK/network error
        raise AIRequestFailed(str(exc)) from exc

    text = (response.text or "").strip()
    if not text:
        # Empty usually means a safety block or a finish reason with no content.
        raise AIRequestFailed("The AI returned an empty response.")
    return text


async def stream_reply(
    system_prompt: str | None,
    history: Sequence[tuple[str, str]],
) -> AsyncIterator[str]:
    """Yield the assistant's reply in chunks as Gemini generates it.

    Same inputs as :func:`generate_reply`; the caller accumulates the chunks to
    persist the full reply once the stream ends.
    """
    if _client is None:
        raise AINotConfigured

    config = types.GenerateContentConfig(system_instruction=system_prompt or None)

    try:
        stream = await _client.aio.models.generate_content_stream(
            model=settings.gemini_model,
            contents=_to_contents(history),
            config=config,
        )
        async for chunk in stream:
            if chunk.text:
                yield chunk.text
    except (AINotConfigured, AIRequestFailed):
        raise
    except Exception as exc:  # noqa: BLE001 — normalise any SDK/network error
        raise AIRequestFailed(str(exc)) from exc
