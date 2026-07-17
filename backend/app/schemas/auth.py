from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):

    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):

    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class Token(BaseModel):

    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):

    id: int
    username: str

    model_config = {"from_attributes": True}
