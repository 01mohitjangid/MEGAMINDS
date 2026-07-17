# MegaMinds — AI Chat Dashboard

A full-stack AI chat app. You sign up, chat with an AI, and all your chats are
saved. You can switch the AI's "persona" (its system prompt) to change how it
talks, and replies stream in live, word by word.

Built for the Megaminds IT Services take-home task (Option B).

## Features

- Sign up and log in (passwords are hashed, sessions use JWT tokens)
- Multi-turn chat — the AI remembers the whole conversation
- Saved history — reopen, rename, or delete old chats
- Personas — pick a built-in one (Assistant, Code Mentor, Brainstormer) or make your own
- Live streaming replies (Server-Sent Events)

## Tech Stack

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Python FastAPI
- **Database:** PostgreSQL (SQLAlchemy + Alembic migrations)
- **Auth:** JWT + bcrypt
- **AI:** Google Gemini API

## Getting Started

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a file `backend/.env`:

```env
DATABASE_URL=postgresql://megaminds:megaminds@localhost:5433/megaminds
JWT_SECRET_KEY=change-me
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-flash-lite-latest
BACKEND_CORS_ORIGINS=http://localhost:5173
```

Start the database (or use a cloud Postgres URL instead), set up the tables, and run the API:

```bash
docker compose up -d       # starts PostgreSQL on port 5433
alembic upgrade head       # create the tables
python -m app.seed         # add the default personas
uvicorn app.main:app --reload
```

API runs at http://127.0.0.1:8000 (docs at `/docs`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at http://localhost:5173.

## How It Works

The database has four tables: **users**, **personas**, **conversations**, and
**messages**. When you send a message, the backend loads the full conversation
history, adds the persona's system prompt, and sends it all to Gemini. That's
what gives the AI its memory and lets a persona change its behaviour. The reply
is streamed back to the browser piece by piece and saved to the database.

## Main API Endpoints

All routes are under `/api`. Everything except register/login needs an
`Authorization: Bearer <token>` header.

| Method | Path | What it does |
|--------|------|--------------|
| POST | `/auth/register`, `/auth/login` | Create account / log in |
| GET | `/auth/me` | Current user |
| GET / POST | `/personas` | List / create personas |
| GET / POST | `/conversations` | List / start chats |
| POST | `/conversations/{id}/messages/stream` | Send a message, stream the reply |
