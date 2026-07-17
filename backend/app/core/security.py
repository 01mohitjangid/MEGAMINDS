"""Password hashing and JWT access tokens.

Kept deliberately small: bcrypt for password hashing (used directly, no passlib
layer) and PyJWT for signing/verifying short-lived access tokens. All tuning
(secret, algorithm, expiry) comes from `settings`.
"""

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings

# bcrypt only hashes the first 72 bytes of input; longer passwords are silently
# truncated by the algorithm. We truncate explicitly so hashing and verifying
# always agree on the same bytes.
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Return a salted bcrypt hash for `password`."""
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Check `password` against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(password), hashed.encode("utf-8"))
    except ValueError:
        # Malformed/legacy hash — treat as a failed match rather than crashing.
        return False


def create_access_token(subject: str | int) -> str:
    """Sign a JWT whose `sub` claim identifies the user (their id)."""
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Return the token's subject (user id as a string), or None if invalid."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None
    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None
