# MegaMinds — AI Chat Dashboard

A full-stack, multi-turn AI chat app. Users sign up, chat with an LLM, keep a
full history of their conversations, and switch the AI's **persona** (system
prompt) to change how it responds. Replies stream in **real time**, token by
token.

> Built for the Megaminds IT Services take-home task — **Option B: AI Chat Dashboard**.

---

## ✨ Features

- **User authentication** — register / login with hashed passwords and JWT tokens.
- **Multi-turn chat** — the AI remembers the whole conversation, not just the last message.
- **Conversation history** — every chat is saved per user and can be reopened, renamed, or deleted.
- **AI personas** — switch between system prompts (Assistant, Code Mentor, Brainstormer) or create your own.
- **Real-time streaming** — answers appear live as the model generates them (Server-Sent Events).

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript, Vite, Motion (animations) |
| Backend | Python **FastAPI** (async REST API) |
| Database | PostgreSQL (async SQLAlchemy 2.0 + psycopg3), Alembic migrations |
| Auth | JWT access tokens (`pyjwt`) + `bcrypt` password hashing |
| AI | Google **Gemini** API (`google-genai`, async, streaming) |

---

## 🗂️ Architecture — every file explained

```
MegaMinds/
│
├── backend/                          # FastAPI REST API (Python)
│   ├── app/
│   │   ├── main.py                   # App entry point: creates the FastAPI app, CORS, mounts /api routes
│   │   ├── seed.py                   # `python -m app.seed` — inserts the default personas (idempotent)
│   │   │
│   │   ├── core/                     # Cross-cutting foundations
│   │   │   ├── config.py             # All settings, loaded from .env (DB URL, JWT, Gemini key/model)
│   │   │   ├── database.py           # Async SQLAlchemy engine + session factory + `get_db` dependency
│   │   │   └── security.py           # bcrypt password hashing + JWT create/decode
│   │   │
│   │   ├── models/                   # Database tables (SQLAlchemy ORM)
│   │   │   ├── user.py               # users — id, username, hashed_password
│   │   │   ├── persona.py            # personas — system_prompt; user_id NULL = built-in default
│   │   │   ├── conversation.py       # conversations — owned by a user, pinned to a persona
│   │   │   └── message.py            # messages — one turn (role: user/assistant) in a conversation
│   │   │
│   │   ├── schemas/                  # Pydantic request/response shapes (the API contract)
│   │   │   ├── auth.py               # RegisterRequest, LoginRequest, Token, UserRead
│   │   │   └── chat.py               # Persona/Conversation/Message create-read-update shapes
│   │   │
│   │   ├── api/
│   │   │   ├── router.py             # Aggregates every route module under /api
│   │   │   ├── deps.py               # `get_current_user` — turns the Bearer token into a User (or 401)
│   │   │   └── routes/
│   │   │       ├── health.py         # GET /health, /health/db — liveness + DB probe
│   │   │       ├── auth.py           # POST /auth/register, /auth/login · GET /auth/me
│   │   │       ├── personas.py       # GET/POST /personas · PATCH/DELETE /personas/{id}
│   │   │       └── conversations.py  # Conversation CRUD + rename + send-message +
│   │   │                             #   POST /conversations/{id}/messages/stream (SSE streaming,
│   │   │                             #   multi-turn context assembly, AI-generated titles)
│   │   │
│   │   └── services/
│   │       └── gemini.py             # The ONLY place that talks to Google Gemini
│   │                                 #   (generate_reply + stream_reply, role mapping, error types)
│   │
│   ├── alembic/                      # Database migrations
│   │   ├── env.py                    # Wires Alembic to our settings + model metadata
│   │   └── versions/                 # One file per schema change (users/personas/convs/messages)
│   ├── alembic.ini                   # Alembic config
│   ├── requirements.txt              # Python dependencies (pinned)
│   └── .env.example                  # Template for backend/.env — copy & fill, never commit .env
│
├── frontend/                         # React + TypeScript single-page app (Vite)
│   ├── index.html                    # HTML shell Vite injects the app into
│   ├── vite.config.ts                # Vite build/dev-server config
│   ├── package.json                  # JS dependencies & scripts (dev/build/lint)
│   └── src/
│       ├── main.tsx                  # React entry: Router + AuthProvider + MotionConfig wrap the app
│       ├── App.tsx                   # Routes: /login, /register, / (protected chat)
│       ├── index.css                 # Design tokens (colors, fonts, dark mode) + global styles
│       ├── App.css                   # All component styles (home, chat, sidebar, modals…)
│       │
│       ├── lib/
│       │   └── api.ts                # Typed API client: token storage, every endpoint,
│       │                             #   and the SSE stream reader (streamMessage + AbortController)
│       │
│       ├── auth/
│       │   ├── auth-context.ts       # React context + `useAuth()` hook
│       │   └── AuthProvider.tsx      # Holds the user, restores session from the stored JWT
│       │
│       ├── pages/
│       │   ├── Login.tsx             # Login page (uses AuthForm)
│       │   ├── Register.tsx          # Register page (uses AuthForm)
│       │   └── Chat.tsx              # Main screen: greeting home (suggestions, recent chats)
│       │                             #   + conversation view + streaming send/stop logic
│       │
│       └── components/
│           ├── AuthForm.tsx          # Shared username+password form
│           ├── ProtectedRoute.tsx    # Redirects logged-out users to /login
│           ├── PublicOnlyRoute.tsx   # Redirects logged-in users away from /login
│           ├── AILoader.tsx          # Animated fullscreen loader (auth check)
│           ├── ConfirmDialog.tsx     # "Are you sure?" modal for deletes
│           ├── icons.tsx             # Inline SVG icon set (no emoji icons)
│           └── chat/
│               ├── Sidebar.tsx       # Drawer: new chat, conversation list, rename/delete
│               ├── MessageThread.tsx # The thread: user pills + assistant cards + typing cursor
│               ├── Composer.tsx      # Message input (Enter=send, Stop while streaming)
│               └── PersonaManager.tsx# Modal to create/edit/delete your personas
│
├── api/
│   └── index.py                      # Vercel serverless entry — wraps the FastAPI app for deploy
├── vercel.json                       # Vercel config: builds frontend + routes /api/* to FastAPI
├── requirements.txt                  # Root copy of backend deps (Vercel reads this)
├── docker-compose.yml                # Local PostgreSQL 16 (host port 5433, volume-persisted)
└── .gitignore                        # Keeps .env, node_modules, .venv etc. out of git
```

**How a message flows:** `Composer.tsx` → `streamMessage()` in `lib/api.ts` →
`POST /api/conversations/{id}/messages/stream` in `conversations.py` → ownership
check (`deps.py`) → history loaded from `models/message.py` → persona's
system_prompt + history sent to Gemini (`services/gemini.py`) → tokens streamed
back as SSE → `MessageThread.tsx` renders them live → full reply + AI-generated
title persisted to PostgreSQL.

---

## ⚙️ Backend Setup (FastAPI)

The backend is a REST API served by **Uvicorn**. It handles auth, stores chat
data in PostgreSQL, and calls the Gemini API.

**1. Install dependencies**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**2. Create `backend/.env`** (never commit this — it holds secrets)
```env
APP_ENV=development
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Local Docker Postgres, OR paste a cloud URL (Neon/Supabase/Railway)
DATABASE_URL=postgresql://megaminds:megaminds@localhost:5433/megaminds

# Auth — generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
JWT_SECRET_KEY=change-me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI — get a key at https://ai.google.dev
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-flash-lite-latest
```

**3. Start the database** (skip if using a cloud URL)
```bash
docker compose up -d          # runs PostgreSQL on localhost:5433
```

**4. Run migrations + seed the default personas**
```bash
alembic upgrade head          # create the tables
python -m app.seed            # add Assistant / Code Mentor / Brainstormer
```

**5. Start the API**
```bash
uvicorn app.main:app --reload
```
API runs at **http://127.0.0.1:8000** — interactive docs at **/docs**.

---

## 🎨 Frontend Setup (React)

```bash
cd frontend
npm install
npm run dev
```
App runs at **http://localhost:5173**.

By default it calls the backend at `http://127.0.0.1:8000`. To point elsewhere,
create `frontend/.env`:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## 🔌 API Endpoints

All endpoints are under `/api`. Everything except register/login needs a
`Authorization: Bearer <token>` header.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/register` | Create an account, returns a token |
| `POST` | `/api/auth/login` | Log in, returns a token |
| `GET`  | `/api/auth/me` | Current logged-in user |
| `GET` / `POST` | `/api/personas` | List / create personas |
| `PATCH` / `DELETE` | `/api/personas/{id}` | Edit / delete your persona |
| `GET` / `POST` | `/api/conversations` | List / start conversations |
| `GET` / `PATCH` / `DELETE` | `/api/conversations/{id}` | Open / rename / delete a chat |
| `POST` | `/api/conversations/{id}/messages` | Send a message, get a reply |
| `POST` | `/api/conversations/{id}/messages/stream` | Send a message, stream the reply live |
| `GET`  | `/api/health` · `/api/health/db` | Health checks |

---

## 🗃️ Database Schema

Four tables, all owned per user:

- **users** — `id`, `username` (unique), `hashed_password`, `created_at`
- **personas** — `id`, `user_id` (null = built-in default), `name`, `description`, `system_prompt`
- **conversations** — `id`, `user_id`, `persona_id`, `title`, timestamps
- **messages** — `id`, `conversation_id`, `role` (`user` / `assistant`), `content`, `created_at`

A user has many conversations; a conversation has many messages and one
optional persona. Chat history is simply the ordered `messages` of a
conversation, replayed to Gemini on each turn to give it memory.

---

## 🤖 How the AI Works

On each message, the backend loads the conversation's full history, maps it into
Gemini's format (`user` / `model` roles), and sends it along with the persona's
`system_prompt` as the system instruction — that instruction is what makes
persona switching actually change the AI's behaviour. The reply is streamed back
to the browser chunk by chunk.
