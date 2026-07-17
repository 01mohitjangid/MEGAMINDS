from datetime import datetime

from pydantic import BaseModel, Field


class PersonaRead(BaseModel):
    id: int
    name: str
    description: str
    system_prompt: str
    is_default: bool

    model_config = {"from_attributes": True}


class MessageRead(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    persona_id: int | None = None


class ConversationRead(BaseModel):

    id: int
    title: str
    persona_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationRead):

    messages: list[MessageRead]


class PersonaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=255)
    system_prompt: str = Field(min_length=1, max_length=4000)


class PersonaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    system_prompt: str | None = Field(default=None, min_length=1, max_length=4000)


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class SendMessageResponse(BaseModel):

    user_message: MessageRead
    assistant_message: MessageRead
    title: str
