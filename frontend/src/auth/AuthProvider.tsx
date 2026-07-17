import { useCallback, useEffect, useMemo, useState } from "react";
import { auth, getToken, setToken, type AuthUser } from "../lib/api";
import { AuthContext, type AuthContextValue } from "./auth-context";

/**
 * Holds the signed-in user in React state and keeps the JWT in localStorage.
 * On mount, if a token is already stored it verifies it via /auth/me so a
 * refresh keeps the session; an invalid token is discarded.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (getToken() === null) {
      setLoading(false);
      return;
    }
    auth
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(
    async (token: string) => {
      setToken(token);
      setUser(await auth.me());
    },
    [],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const { access_token } = await auth.login(username, password);
      await authenticate(access_token);
    },
    [authenticate],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const { access_token } = await auth.register(username, password);
      await authenticate(access_token);
    },
    [authenticate],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
