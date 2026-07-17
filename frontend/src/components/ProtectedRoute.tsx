import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

/**
 * Wraps routes that require a signed-in user. While the initial session check
 * runs we show a placeholder; once done, an unauthenticated user is bounced to
 * /login and everyone else sees the protected content.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="shell">
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
