"""Conversation routes — CRUD plus the send-a-message chat endpoint.

Every route is scoped to the authenticated user: a conversation that isn't
theirs returns 404 (never 403), so its existence isn't even leaked.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import AsyncSessionLocal, get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.persona import Persona
from app.models.user import User
from app.schemas.chat import (
    ConversationCreate,
    ConversationDetail,
    ConversationRead,
    ConversationUpdate,
    MessageCreate,
    MessageRead,
    SendMessageResponse,
)
from app.services import gemini

router = APIRouter(prefix="/conversations", tags=["conversations"])

_TITLE_MAX_LEN = 50


async def _get_owned_conversation(
    db: AsyncSession, user_id: int, conversation_id: int
) -> Conversation:
    """Load a conversation that belongs to the user, or raise 404."""
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None or conversation.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )
    return conversation


async def _validate_persona(
    db: AsyncSession, user_id: int, persona_id: int | None
) -> None:
    """Ensure a chosen persona is a built-in default or owned by the user."""
    if persona_id is None:
        return
    result = await db.execute(
        select(Persona.id).where(
            Persona.id == persona_id,
            or_(Persona.user_id.is_(None), Persona.user_id == user_id),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found"
        )


def _title_from(text: str) -> str:
    """Derive a conversation title from the first user message."""
    single_line = " ".join(text.split())
    if len(single_line) <= _TITLE_MAX_LEN:
        return single_line
    return single_line[: _TITLE_MAX_LEN - 1].rstrip() + "…"


def _sse(payload: dict) -> str:
    """Format a Server-Sent Events data frame."""
    return f"data: {json.dumps(payload)}\n\n"


async def _ai_title(user_msg: str, reply: str) -> str | None:
    """Ask the model for a short, professional conversation title
    (like ChatGPT/Gemini do). Returns None on any failure so callers
    can fall back to simple truncation."""
    prompt = (
        "Write a concise title (3-6 words, plain text, no quotes, no trailing "
        "punctuation) summarizing this chat.\n\n"
        f"User: {user_msg[:500]}\n\nAssistant: {reply[:400]}\n\nTitle:"
    )
    try:
        title = await gemini.generate_reply(None, [("user", prompt)])
    except Exception:  # noqa: BLE001 — titles are best-effort, never fail the send
        return None
    title = title.strip().strip('"').strip("'").splitlines()[0].strip()
    return title[:_TITLE_MAX_LEN] if title else None


@router.post("", response_model=ConversationRead, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    await _validate_persona(db, current_user.id, body.persona_id)
    conversation = Conversation(user_id=current_user.id, persona_id=body.persona_id)
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.get("", response_model=list[ConversationRead])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    """The caller's conversations, most recently active first (sidebar)."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
    )
    return list(result.scalars().all())


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetail:
    conversation = await _get_owned_conversation(db, current_user.id, conversation_id)
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    messages = result.scalars().all()
    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        persona_id=conversation.persona_id,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[MessageRead.model_validate(m) for m in messages],
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    conversation = await _get_owned_conversation(db, current_user.id, conversation_id)
    await db.delete(conversation)  # messages cascade via FK ondelete
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{conversation_id}", response_model=ConversationRead)
async def rename_conversation(
    conversation_id: int,
    body: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    conversation = await _get_owned_conversation(db, current_user.id, conversation_id)
    conversation.title = body.title.strip()
    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.post("/{conversation_id}/messages", response_model=SendMessageResponse)
async def send_message(
    conversation_id: int,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SendMessageResponse:
    """Save the user's message, ask Gemini with full context, save the reply.

    The whole thing is one transaction: if the AI call fails, nothing is
    persisted, so the user can simply retry.
    """
    conversation = await _get_owned_conversation(db, current_user.id, conversation_id)

    # Is this the first message? (drives the auto-title)
    existing_count = await db.scalar(
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id == conversation.id)
    )
    is_first_message = existing_count == 0

    # 1) Save the user's message (flush so the history query below sees it).
    user_message = Message(
        conversation_id=conversation.id, role="user", content=body.content
    )
    db.add(user_message)
    await db.flush()

    # 2) Assemble context: system instruction (persona) + full ordered history.
    system_prompt: str | None = None
    if conversation.persona_id is not None:
        persona = await db.get(Persona, conversation.persona_id)
        if persona is not None:
            system_prompt = persona.system_prompt

    history_rows = await db.execute(
        select(Message.role, Message.content)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    history = [(row.role, row.content) for row in history_rows.all()]

    # 3) Call Gemini. Domain errors map to clean HTTP statuses; the session
    #    rolls back automatically on exception so no partial write survives.
    try:
        reply_text = await gemini.generate_reply(system_prompt, history)
    except gemini.AINotConfigured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is not configured. Set GEMINI_API_KEY on the server.",
        ) from None
    except gemini.AIRequestFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The AI service failed: {exc}",
        ) from exc

    # 4) Save the reply, auto-title on the first turn, bump activity timestamp.
    assistant_message = Message(
        conversation_id=conversation.id, role="assistant", content=reply_text
    )
    db.add(assistant_message)
    if is_first_message:
        conversation.title = _title_from(body.content)
    conversation.updated_at = func.now()

    await db.commit()
    await db.refresh(user_message)
    await db.refresh(assistant_message)
    await db.refresh(conversation)

    return SendMessageResponse(
        user_message=MessageRead.model_validate(user_message),
        assistant_message=MessageRead.model_validate(assistant_message),
        title=conversation.title,
    )


@router.post("/{conversation_id}/messages/stream")
async def stream_message(
    conversation_id: int,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Send a message and stream the AI reply back as Server-Sent Events.

    Events (each a JSON ``data:`` frame): ``start`` (user_message_id), ``token``
    (a chunk of text), ``done`` (final title + full content), or ``error``.
    The full reply is persisted with a fresh session once the stream finishes —
    so even if the client hits Stop mid-stream, the partial text that was already
    generated is saved and the thread stays consistent.
    """
    conversation = await _get_owned_conversation(db, current_user.id, conversation_id)

    if not gemini.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is not configured. Set GEMINI_API_KEY on the server.",
        )

    existing_count = await db.scalar(
        select(func.count())
        .select_from(Message)
        .where(Message.conversation_id == conversation.id)
    )
    is_first_message = existing_count == 0
    new_title = _title_from(body.content)
    existing_title = conversation.title
    cid = conversation.id

    # Persist the user's turn up front so history includes it and it survives
    # even if the reply is stopped.
    user_message = Message(conversation_id=cid, role="user", content=body.content)
    db.add(user_message)
    await db.commit()
    await db.refresh(user_message)
    user_message_id = user_message.id

    system_prompt: str | None = None
    if conversation.persona_id is not None:
        persona = await db.get(Persona, conversation.persona_id)
        if persona is not None:
            system_prompt = persona.system_prompt

    history_rows = await db.execute(
        select(Message.role, Message.content)
        .where(Message.conversation_id == cid)
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    history = [(row.role, row.content) for row in history_rows.all()]

    async def event_stream():
        yield _sse({"type": "start", "user_message_id": user_message_id})
        chunks: list[str] = []
        error_detail: str | None = None
        try:
            async for piece in gemini.stream_reply(system_prompt, history):
                chunks.append(piece)
                yield _sse({"type": "token", "text": piece})
        except gemini.AINotConfigured:
            error_detail = "AI is not configured. Set GEMINI_API_KEY on the server."
        except gemini.AIRequestFailed as exc:
            error_detail = f"The AI service failed: {exc}"
        finally:
            # Persist with a FRESH session: the request session may be tearing
            # down (client disconnect), and we still want the partial saved.
            full = "".join(chunks).strip()
            final_title = new_title
            if full and is_first_message:
                final_title = (await _ai_title(body.content, full)) or new_title
            try:
                async with AsyncSessionLocal() as store:
                    if full:
                        store.add(
                            Message(conversation_id=cid, role="assistant", content=full)
                        )
                        conv = await store.get(Conversation, cid)
                        if conv is not None:
                            if is_first_message:
                                conv.title = final_title
                            conv.updated_at = func.now()
                        await store.commit()
                    elif error_detail is not None:
                        # Nothing generated and errored: drop the orphan user turn.
                        orphan = await store.get(Message, user_message_id)
                        if orphan is not None:
                            await store.delete(orphan)
                            await store.commit()
            except Exception:  # noqa: BLE001 — never let persistence crash teardown
                pass

        if error_detail is not None:
            yield _sse({"type": "error", "detail": error_detail})
        else:
            yield _sse(
                {
                    "type": "done",
                    "title": final_title if is_first_message else existing_title,
                    "content": "".join(chunks).strip(),
                }
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
