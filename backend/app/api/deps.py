"""Shared FastAPI dependencies for protected routes.

`get_current_user` is the gatekeeper: it extracts the bearer token, verifies it,
loads the user, and 401s otherwise. Any route that takes it as a dependency is
automatically protected — no token (or a bad one) means no access.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

# tokenUrl is only metadata for the docs "Authorize" button; the real login
# endpoint is /api/auth/login.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    subject = decode_access_token(token)
    if subject is None:
        raise _CREDENTIALS_ERROR

    try:
        user_id = int(subject)
    except ValueError:
        raise _CREDENTIALS_ERROR from None

    user = await db.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_ERROR
    return user
