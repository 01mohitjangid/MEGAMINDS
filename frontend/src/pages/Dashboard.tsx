import { useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { API_BASE_URL, ApiError, health } from "../lib/api";

type Status = "checking" | "ok" | "error";

interface CheckState {
  status: Status;
  detail: string;
}

const INITIAL: CheckState = { status: "checking", detail: "Contacting…" };

function StatusRow({ label, state }: { label: string; state: CheckState }) {
  return (
    <div className="status-row">
      <span className={`dot dot--${state.status}`} aria-hidden />
      <div className="status-row__text">
        <span className="status-row__label">{label}</span>
        <span className="status-row__detail">{state.detail}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [api, setApi] = useState<CheckState>(INITIAL);
  const [db, setDb] = useState<CheckState>(INITIAL);

  async function runChecks() {
    setApi(INITIAL);
    setDb(INITIAL);

    try {
      const res = await health.api();
      setApi({ status: "ok", detail: `${res.service} · ${res.env}` });
    } catch (err) {
      setApi({
        status: "error",
        detail: err instanceof ApiError ? err.message : "Unknown error",
      });
    }

    try {
      const res = await health.db();
      setDb({ status: "ok", detail: `PostgreSQL · ${res.database}` });
    } catch (err) {
      setDb({
        status: "error",
        detail: err instanceof ApiError ? err.message : "Unknown error",
      });
    }
  }

  useEffect(() => {
    runChecks();
  }, []);

  const allOk = api.status === "ok" && db.status === "ok";

  return (
    <main className="shell">
      <div className="card">
        <header className="card__header">
          <span className="badge">Phase 2 · Authentication</span>
          <h1>Welcome, {user?.username}</h1>
          <p className="subtitle">
            You're signed in. This dashboard verifies the frontend, backend, and
            database are wired together end-to-end.
          </p>
        </header>

        <section className="checks">
          <StatusRow label="Backend API" state={api} />
          <StatusRow label="Database" state={db} />
        </section>

        <footer className="card__footer">
          <span className={`overall overall--${allOk ? "ok" : "pending"}`}>
            {allOk ? "All systems connected" : "Waiting for services…"}
          </span>
          <div className="actions">
            <code className="endpoint">{API_BASE_URL}</code>
            <button className="btn" onClick={runChecks}>
              Re-check
            </button>
            <button className="btn btn--ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
