import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { AILoader } from "./AILoader";

/**
 * Wraps routes that only make sense when signed OUT (login, register). Once a
 * user is authenticated, visiting them redirects to the dashboard — this is
 * what carries the user forward after a successful login/register, and also
 * stops an already-logged-in user from seeing the auth forms again.
 */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AILoader text="MegaMinds" />;
  }

  if (user !== null) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
