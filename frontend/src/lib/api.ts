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

/** Perform a JSON request against the API and return the parsed body. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch {
    // Network-level failure (server down, CORS, DNS, offline).
    throw new ApiError("Unable to reach the API server.");
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`, response.status);
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
