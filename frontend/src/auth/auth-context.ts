import { createContext, useContext } from "react";
import type { AuthUser } from "../lib/api";

export interface AuthContextValue {
  user: AuthUser | null;
  /** True while the initial "am I already logged in?" check is running. */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Access auth state/actions. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
