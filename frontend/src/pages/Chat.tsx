import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Composer } from "../components/chat/Composer";
import { MessageThread } from "../components/chat/MessageThread";
import { PersonaManager } from "../components/chat/PersonaManager";
import { Sidebar } from "../components/chat/Sidebar";
import {
  ApiError,
  conversations as convApi,
  personas as personaApi,
  streamMessage,
  type Conversation,
  type Message,
  type Persona,
} from "../lib/api";

export default function Chat() {
  const { user, logout } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newPersonaId, setNewPersonaId] = useState<number | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [personaManagerOpen, setPersonaManagerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const activeIdRef = useRef<number | null>(activeId);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Auto-dismiss the error toast.
  useEffect(() => {
    if (error === null) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const loadPersonas = useCallback(() => {
    personaApi.list().then(setPersonas).catch(() => {});
  }, []);

  useEffect(() => {
    loadPersonas();
    convApi
      .list()
      .then(setConversations)
      .catch(() => setError("Couldn't load conversations. Is the API running?"))
      .finally(() => setLoadingList(false));
  }, [loadPersonas]);

  const openConversation = useCallback(async (id: number) => {
    setActiveId(id);
    setSidebarOpen(false);
    setError(null);
    setMessages([]);
    try {
      const detail = await convApi.get(id);
      setMessages(detail.messages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversation.");
    }
  }, []);

  async function handleNewChat() {
    setError(null);
    try {
      const conv = await convApi.create(newPersonaId);
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
      setSidebarOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start a chat.");
    }
  }

  async function confirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (id === null) return;
    try {
      await convApi.remove(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete conversation.");
    }
  }

  async function handleRename(id: number, title: string) {
    // Optimistic; revert on failure.
    const prevTitle = conversations.find((c) => c.id === id)?.title;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
    try {
      await convApi.rename(id, title);
    } catch (err) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: prevTitle ?? c.title } : c)),
      );
      setError(err instanceof ApiError ? err.message : "Failed to rename.");
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleSend(content: string) {
    if (activeId === null) return;
    const convId = activeId;
    setError(null);

    const tempUserId = -Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content, created_at: "" },
    ]);
    setStreaming(true);
    setStreamingText("");

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    let doneTitle: string | null = null;
    let errored = false;

    try {
      await streamMessage(convId, content, ac.signal, {
        onToken: (t) => {
          acc += t;
          if (activeIdRef.current === convId) setStreamingText(acc);
        },
        onDone: (title) => {
          doneTitle = title;
        },
        onError: (detail) => {
          errored = true;
          setError(detail);
        },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name !== "AbortError") {
        errored = true;
        setError(err instanceof ApiError ? err.message : "Failed to stream reply.");
      }
      // AbortError = user pressed Stop; the backend saved whatever streamed.
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStreamingText("");

      const finalText = acc.trim();
      if (activeIdRef.current === convId) {
        setMessages((prev) => {
          if (finalText) {
            return [
              ...prev,
              { id: tempUserId - 1, role: "assistant", content: finalText, created_at: "" },
            ];
          }
          // Nothing generated + errored → backend rolled back the user turn.
          if (errored) return prev.filter((m) => m.id !== tempUserId);
          return prev;
        });
      }

      if (finalText) {
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === convId ? { ...c, title: doneTitle ?? c.title } : c,
          );
          const active = updated.find((c) => c.id === convId);
          if (!active) return updated;
          return [active, ...updated.filter((c) => c.id !== convId)];
        });
      }
    }
  }

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className={`chat${sidebarOpen ? " chat--sidebar-open" : ""}`}>
      <div
        className="chat__scrim"
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      <Sidebar
        personas={personas}
        conversations={conversations}
        activeId={activeId}
        newPersonaId={newPersonaId}
        username={user?.username ?? ""}
        loading={loadingList}
        onPersonaChange={setNewPersonaId}
        onNewChat={handleNewChat}
        onSelect={openConversation}
        onDelete={(id) => setConfirmDeleteId(id)}
        onRename={handleRename}
        onManagePersonas={() => setPersonaManagerOpen(true)}
        onLogout={logout}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="chat__main">
        {activeConversation === null ? (
          <div className="chat__placeholder">
            <button
              className="chat__menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <h1>MegaMinds</h1>
            <p className="subtitle">
              Pick a persona and start a new chat, or open a conversation.
            </p>
          </div>
        ) : (
          <>
            <header className="chat__header">
              <button
                className="chat__menu"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                ☰
              </button>
              <h2 className="chat__title">{activeConversation.title}</h2>
            </header>

            <MessageThread
              messages={messages}
              streaming={streaming}
              streamingText={streamingText}
            />
            <Composer streaming={streaming} onSend={handleSend} onStop={handleStop} />
          </>
        )}
      </main>

      {error !== null && (
        <div className="toast" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {personaManagerOpen && (
        <PersonaManager
          personas={personas}
          onClose={() => setPersonaManagerOpen(false)}
          onChanged={loadPersonas}
          onError={setError}
        />
      )}

      {confirmDeleteId !== null && (
        <ConfirmDialog
          title="Delete conversation"
          message="This conversation and its messages will be permanently deleted."
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
