/**
 * Thin, typed API client for the backend.
 *
 * A single place to configure the base URL and centralise request handling so
 * feature code (auth, chat, personas in later phases) stays clean. Auth token
 * injection and error normalisation will be layered on here in Phase 2.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// --- Auth token storage ---
// The JWT lives in localStorage so a page refresh keeps the user signed in.
const TOKEN_KEY = "megaminds.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Pull a human-readable message out of a FastAPI error body. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first.msg === "string") return first.msg;
    }
  } catch {
    // Non-JSON body — fall through to the generic message.
  }
  return `Request failed (${response.status})`;
}

/** Perform a JSON request against the API and return the parsed body. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // Network-level failure (server down, CORS, DNS, offline).
    throw new ApiError("Unable to reach the API server.");
  }

  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

export { API_BASE_URL };

// --- Endpoint response types ---
export interface HealthResponse {
  status: string;
  service: string;
  env: string;
}

export interface DbHealthResponse {
  status: string;
  database: string;
}

export const health = {
  api: () => apiFetch<HealthResponse>("/api/health"),
  db: () => apiFetch<DbHealthResponse>("/api/health/db"),
};

// --- Auth ---
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface AuthUser {
  id: number;
  username: string;
}

export const auth = {
  register: (username: string, password: string) =>
    apiFetch<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    apiFetch<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiFetch<AuthUser>("/api/auth/me"),
};
