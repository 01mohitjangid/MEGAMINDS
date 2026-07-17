from collections.abc import AsyncIterator, Sequence

from google import genai
from google.genai import types

from app.core.config import settings

_ROLE_MAP = {"user": "user", "assistant": "model"}


class AINotConfigured(Exception):
    pass


class AIRequestFailed(Exception):
    pass


_client: genai.Client | None = (
    genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None
)


def is_configured() -> bool:
    return _client is not None


def _to_contents(history: Sequence[tuple[str, str]]) -> list[types.Content]:
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
        raise AIRequestFailed("The AI returned an empty response.")
    return text


async def stream_reply(
    system_prompt: str | None,
    history: Sequence[tuple[str, str]],
) -> AsyncIterator[str]:
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
