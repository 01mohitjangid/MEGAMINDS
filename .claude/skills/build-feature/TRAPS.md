# Repo traps — MegaMinds build-feature

Quick-load list of non-obvious failures the loop has hit in **MegaMinds**. Read
this at the start of every run. This is the **single source of truth** for the
learning loop — when the verifier reports a **NEW TRAP**, append it here (one
line). Lives in `.claude/` with the rest of the loop.

This file starts nearly empty on purpose — MegaMinds hasn't taught the loop much
yet. The seeds below are stack-specific starting points; extend them with real
gotchas as you find them.

Stack: **frontend** Vite + React + TypeScript (npm, oxlint) · **backend** FastAPI
+ SQLAlchemy 2.0 (async) + Alembic (Python).

## Seeds

- **Two apps, two toolchains — run the gate from the repo root.** `gate.sh` runs
  frontend checks in `frontend/` and backend checks in `backend/`. A "green" that
  only ran one side is not green. Check what the gate actually ran.
- **Frontend typecheck is `tsc -b` (project references), not plain `tsc`.** The app
  splits `tsconfig.app.json` / `tsconfig.node.json`; `npx tsc -b` typechecks the
  solution without emitting (Vite bundles). Plain `tsc` misconfigures the refs.
- **Backend has no lint/type/test tooling yet.** Until `ruff`/`mypy`/`pytest` are in
  `backend/requirements.txt` and enabled in `gate.sh`, the backend is unchecked by
  the gate — verify backend changes by running the app. Don't claim "backend green."
- **Alembic migrations are a linear revision chain (`down_revision`).** Two branches
  each adding a migration collide on `down_revision`; on merge, renumber so one
  chains off the other (analogous to any single-file migration-order conflict). Run
  `alembic history` / `alembic heads` — more than one head means the chain forked.
- **Async SQLAlchemy — don't block the event loop.** Sessions/engines are async
  (`psycopg` async driver); a sync DB call inside an async route stalls the server.
  Use the async session and `await`.
- **Not a git repo yet.** `git init` before the loop's diff/commit steps work
  (verifier diffs against `main`); set up the base branch first.
- **Commit both lockfiles when deps change** — `frontend/package-lock.json` for npm,
  `backend/requirements.txt` for Python. A stale lock fails CI install before checks.

<!-- Append real MegaMinds traps below, one line each: -->
<!-- - **<short title>.** <what bit, why, how to avoid>. (found by <maker|verifier>) -->
- **google-genai v2 async is `client.aio.models.generate_content(...)`.** The sync `client.models.*` call blocks the event loop; always use the `.aio` namespace inside async routes. (found by verifier)
- **Rollback-on-AI-failure depends on flush-not-commit + `get_db`'s `async with` close.** `send_message` flushes (not commits) the user message before calling Gemini; on error the request raises and the session closes → rolls back. Any refactor that commits before the AI call, or swallows the exception before the generator unwinds, leaks a half-written turn. (found by verifier)
- **Bump `conversation.updated_at` explicitly on new messages.** Inserting child `messages` does not mark the parent row dirty, so the model's `onupdate=func.now()` never fires; set `conversation.updated_at = func.now()` in the send path or sidebar ordering goes stale. (found by verifier)
- **Streaming persistence must use a fresh `AsyncSessionLocal()`, not the request `db`.** A `StreamingResponse` body runs AFTER the route returns, and `get_db`'s `async with` teardown closes the request session while the generator is still yielding — writing the accumulated reply on `db` in the `finally` hits a closed/rolled-back session. Open a new session inside the generator. (found by verifier)
- **Streaming commits the user turn up front; clean the orphan only on `full==""` AND error.** The stream path can't reuse `send_message`'s flush-then-rollback (the request session is gone by `finally`), so it commits the user message before streaming and must explicitly delete it when nothing was generated and an error occurred — else a bare user turn leaks. (found by verifier)
