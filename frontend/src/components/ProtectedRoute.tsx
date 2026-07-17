import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { AILoader } from "./AILoader";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AILoader text="MegaMinds" />;
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
