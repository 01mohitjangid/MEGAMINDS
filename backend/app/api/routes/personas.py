"""Persona routes — list built-ins, and CRUD for the caller's own personas."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.persona import Persona
from app.models.user import User
from app.schemas.chat import PersonaCreate, PersonaRead, PersonaUpdate

router = APIRouter(prefix="/personas", tags=["personas"])


def _to_read(p: Persona) -> PersonaRead:
    return PersonaRead(
        id=p.id,
        name=p.name,
        description=p.description,
        system_prompt=p.system_prompt,
        is_default=p.user_id is None,
    )


async def _get_own_persona(
    db: AsyncSession, user_id: int, persona_id: int
) -> Persona:
    """Load a persona the user OWNS (not a built-in default), or 404."""
    persona = await db.get(Persona, persona_id)
    if persona is None or persona.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found"
        )
    return persona


@router.get("", response_model=list[PersonaRead])
async def list_personas(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PersonaRead]:
    """Built-in defaults (user_id IS NULL) plus the caller's own personas."""
    result = await db.execute(
        select(Persona)
        .where(or_(Persona.user_id.is_(None), Persona.user_id == current_user.id))
        # Defaults (NULL sorts first) before user-created, then by id.
        .order_by(Persona.user_id.is_(None).desc(), Persona.id)
    )
    return [_to_read(p) for p in result.scalars().all()]


@router.post("", response_model=PersonaRead, status_code=status.HTTP_201_CREATED)
async def create_persona(
    body: PersonaCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaRead:
    persona = Persona(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        system_prompt=body.system_prompt,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return _to_read(persona)


@router.patch("/{persona_id}", response_model=PersonaRead)
async def update_persona(
    persona_id: int,
    body: PersonaUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaRead:
    persona = await _get_own_persona(db, current_user.id, persona_id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(persona, field, value)
    await db.commit()
    await db.refresh(persona)
    return _to_read(persona)


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_persona(
    persona_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    persona = await _get_own_persona(db, current_user.id, persona_id)
    # Conversations pinned to it keep working; their persona_id is SET NULL by FK.
    await db.delete(persona)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
