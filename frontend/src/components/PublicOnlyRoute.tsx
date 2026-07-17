import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { AILoader } from "./AILoader";

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
