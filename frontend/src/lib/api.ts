const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const TOKEN_KEY = "megaminds.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first.msg === "string") return first.msg;
    }
  } catch {
  }
  return `Request failed (${response.status})`;
}

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
    throw new ApiError("Unable to reach the API server.");
  }

  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { API_BASE_URL };

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

export interface Persona {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  is_default: boolean;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  persona_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface SendMessageResponse {
  user_message: Message;
  assistant_message: Message;
  title: string;
}

export interface PersonaInput {
  name: string;
  description?: string;
  system_prompt: string;
}

export const personas = {
  list: () => apiFetch<Persona[]>("/api/personas"),
  create: (input: PersonaInput) =>
    apiFetch<Persona>("/api/personas", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: number, input: Partial<PersonaInput>) =>
    apiFetch<Persona>(`/api/personas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: number) =>
    apiFetch<void>(`/api/personas/${id}`, { method: "DELETE" }),
};

export const conversations = {
  list: () => apiFetch<Conversation[]>("/api/conversations"),
  create: (personaId: number | null) =>
    apiFetch<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ persona_id: personaId }),
    }),
  get: (id: number) => apiFetch<ConversationDetail>(`/api/conversations/${id}`),
  remove: (id: number) =>
    apiFetch<void>(`/api/conversations/${id}`, { method: "DELETE" }),
  rename: (id: number, title: string) =>
    apiFetch<Conversation>(`/api/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  sendMessage: (id: number, content: string) =>
    apiFetch<SendMessageResponse>(`/api/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};

interface StreamFrame {
  type: "start" | "token" | "done" | "error";
  text?: string;
  title?: string;
  content?: string;
  detail?: string;
  user_message_id?: number;
}

export interface StreamHandlers {
  onStart?: (userMessageId: number) => void;
  onToken: (text: string) => void;
  onDone?: (title: string, content: string) => void;
  onError?: (detail: string) => void;
}

export async function streamMessage(
  conversationId: number,
  content: string,
  signal: AbortSignal,
  handlers: StreamHandlers,
): Promise<void> {
  const token = getToken();
  const response = await fetch(
    `${API_BASE_URL}/api/conversations/${conversationId}/messages/stream`,
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    },
  );

  if (!response.ok || response.body === null) {
    throw new ApiError(await errorMessage(response), response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const payload = JSON.parse(line.slice(5).trim()) as StreamFrame;
      switch (payload.type) {
        case "start":
          handlers.onStart?.(payload.user_message_id ?? 0);
          break;
        case "token":
          handlers.onToken(payload.text ?? "");
          break;
        case "done":
          handlers.onDone?.(payload.title ?? "", payload.content ?? "");
          break;
        case "error":
          handlers.onError?.(payload.detail ?? "The AI service failed.");
          break;
      }
    }
  }
}
