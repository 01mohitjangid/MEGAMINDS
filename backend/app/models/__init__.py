"""ORM models package.

Importing this package imports every model module so that all tables are
registered on `Base.metadata` — Alembic's autogenerate and the app's runtime
relationships both rely on that.
"""

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.persona import Persona
from app.models.user import User

__all__ = ["Conversation", "Message", "Persona", "User"]
