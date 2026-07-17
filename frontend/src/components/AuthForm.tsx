import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../lib/api";

interface AuthFormProps {
  title: string;
  submitLabel: string;
  onSubmit: (username: string, password: string) => Promise<void>;
  altPrompt: string;
  altLinkLabel: string;
  altLinkTo: string;
}

/** Shared username + password form used by both Login and Register. */
export function AuthForm({
  title,
  submitLabel,
  onSubmit,
  altPrompt,
  altLinkLabel,
  altLinkTo,
}: AuthFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(username.trim(), password);
      // On success the auth state updates and the router redirects away.
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <div className="card">
        <header className="card__header">
          <span className="badge">MegaMinds</span>
          <h1>{title}</h1>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field__label">Username</span>
            <input
              className="auth-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-field__label">Password</span>
            <input
              className="auth-input"
              type="password"
              autoComplete={
                submitLabel === "Create account" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn--block" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : submitLabel}
          </button>
        </form>

        <p className="auth-alt">
          {altPrompt} <Link to={altLinkTo}>{altLinkLabel}</Link>
        </p>
      </div>
    </main>
  );
}
