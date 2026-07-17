"""Auth request/response schemas — username + password, nothing more."""

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    """Signup body — enforces the username/password rules."""

    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    """Login body — no policy checks so a bad login always returns a uniform
    401 rather than leaking the password rules via a 422."""

    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class Token(BaseModel):
    """JWT returned on successful register/login."""

    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    """Public view of a user — never includes the password hash."""

    id: int
    username: str

    model_config = {"from_attributes": True}
