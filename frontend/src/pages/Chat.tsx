import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../auth/auth-context";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Composer } from "../components/chat/Composer";
import { MessageThread } from "../components/chat/MessageThread";
import { PersonaManager } from "../components/chat/PersonaManager";
import { Sidebar } from "../components/chat/Sidebar";
import {
  BookIcon,
  FlagIcon,
  MenuIcon,
  SendIcon,
  StarIcon,
} from "../components/icons";
import {
  ApiError,
  conversations as convApi,
  personas as personaApi,
  streamMessage,
  type Conversation,
  type Message,
  type Persona,
} from "../lib/api";

const SUGGESTIONS = [
  { text: "Walk me through how to apply for a new role", Icon: BookIcon },
  { text: "Find hotels for a New Year's trip to Hanoi", Icon: FlagIcon },
  { text: "Suggest the best parks to visit in Bali", Icon: StarIcon },
];

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
  // Open by default; remembered across sessions. Docked on desktop (CSS).
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem("megaminds.sidebar") !== "closed",
  );
  useEffect(() => {
    localStorage.setItem("megaminds.sidebar", sidebarOpen ? "open" : "closed");
  }, [sidebarOpen]);
  // On small screens picking a chat should close the drawer; on desktop it stays.
  const closeSidebarIfMobile = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) setSidebarOpen(false);
  };
  const [personaManagerOpen, setPersonaManagerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [homeDraft, setHomeDraft] = useState("");

  const activeIdRef = useRef<number | null>(activeId);
  const abortRef = useRef<AbortController | null>(null);
  // Synchronous re-entry lock. `streaming` is React state and updates a tick
  // too late to stop a rapid double click/Enter — the second send would fire
  // before it flips, and on the home screen each fire creates its own
  // conversation. This ref flips instantly, so a second send is dropped.
  const sendingRef = useRef(false);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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
    closeSidebarIfMobile();
    setError(null);
    setMessages([]);
    try {
      const detail = await convApi.get(id);
      setMessages(detail.messages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load conversation.");
    }
  }, []);

  function goHome() {
    setActiveId(null);
    setMessages([]);
    closeSidebarIfMobile();
  }

  async function confirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (id === null) return;
    try {
      await convApi.remove(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) goHome();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete conversation.");
    }
  }

  async function handleRename(id: number, title: string) {
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

  /** Stream a message into a conversation (shared by home + chat sends). */
  async function streamInto(convId: number, content: string) {
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

  async function handleSend(content: string) {
    if (activeId === null || sendingRef.current) return;
    sendingRef.current = true;
    try {
      await streamInto(activeId, content);
    } finally {
      sendingRef.current = false;
    }
  }

  /** Home flow: create a conversation with the chosen persona, then send. */
  async function startChatWith(content: string) {
    const text = content.trim();
    if (!text || streaming || sendingRef.current) return;
    sendingRef.current = true;
    try {
      const conv = await convApi.create(newPersonaId);
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      activeIdRef.current = conv.id;
      setMessages([]);
      setHomeDraft("");
      await streamInto(conv.id, text);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start a chat.");
    } finally {
      sendingRef.current = false;
    }
  }

  function handleHomeSubmit(e: FormEvent) {
    e.preventDefault();
    startChatWith(homeDraft);
  }

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const activePersona =
    activeConversation?.persona_id != null
      ? personas.find((p) => p.id === activeConversation.persona_id) ?? null
      : null;
  const firstName = user?.username ?? "";
  const recentChats = conversations.slice(0, 4);

  return (
    <div className={`app${sidebarOpen ? " app--sidebar-open" : ""}`}>
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar__left">
          <button
            className="icon-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <button className="topbar__brand" onClick={goHome} aria-label="Home">
            <span className="brand-mark" aria-hidden>✦</span>
          </button>
        </div>
        <div className="topbar__right">
          <span className="user-pill" title={firstName} aria-label={firstName}>
            <span className="user-pill__avatar" aria-hidden>
              {firstName.slice(0, 1).toUpperCase()}
            </span>
          </span>
          <button className="btn btn--ghost btn--sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div
        className="app__scrim"
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      <Sidebar
        conversations={conversations}
        activeId={activeId}
        username={firstName}
        loading={loadingList}
        onNewChat={goHome}
        onSelect={openConversation}
        onDelete={(id) => setConfirmDeleteId(id)}
        onRename={handleRename}
        onManagePersonas={() => setPersonaManagerOpen(true)}
        onLogout={logout}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="app__main">
        {activeConversation === null ? (
          /* ---------- Home / greeting ---------- */
          <motion.div
            className="home"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="home__inner">
            <h1 className="home__greeting">
              Hello,
              <br />
              How can I help you today?
            </h1>

            <form className="home__composer" onSubmit={handleHomeSubmit}>
              <input
                className="home__input"
                placeholder="Ask anything to start a new chat…"
                value={homeDraft}
                autoFocus
                onChange={(e) => setHomeDraft(e.target.value)}
              />
              <div className="home__composer-row">
                <select
                  className="persona-pill"
                  aria-label="Choose persona"
                  value={newPersonaId ?? ""}
                  onChange={(e) =>
                    setNewPersonaId(e.target.value === "" ? null : Number(e.target.value))
                  }
                >
                  <option value="">No persona</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--round"
                  type="submit"
                  disabled={homeDraft.trim() === ""}
                  aria-label="Start chat"
                >
                  <SendIcon size={15} />
                </button>
              </div>
            </form>

            <section className="home__section">
              <div className="home__section-head">
                <h2>Explore new ideas</h2>
              </div>
              <div className="suggestions">
                {SUGGESTIONS.map(({ text, Icon }) => (
                  <button
                    key={text}
                    className="suggestion-card"
                    onClick={() => startChatWith(text)}
                  >
                    <span>{text}</span>
                    <span className="suggestion-card__icon" aria-hidden>
                      <Icon />
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {recentChats.length > 0 && (
              <section className="home__section">
                <div className="home__section-head">
                  <h2>Continue from last chats</h2>
                  <button
                    className="link-btn"
                    onClick={() => setSidebarOpen(true)}
                  >
                    See all ›
                  </button>
                </div>
                <div className="recent-grid">
                  {recentChats.map((c) => (
                    <button
                      key={c.id}
                      className="recent-card"
                      onClick={() => openConversation(c.id)}
                    >
                      <span className="recent-card__title">{c.title}</span>
                      <span className="recent-card__meta">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            </div>
          </motion.div>
        ) : (
          /* ---------- Conversation ---------- */
          <div className="chat-view">
            <MessageThread
              messages={messages}
              streaming={streaming}
              streamingText={streamingText}
              personaName={activePersona?.name ?? "Assistant"}
            />
            <Composer streaming={streaming} onSend={handleSend} onStop={handleStop} />
          </div>
        )}
      </main>

      <AnimatePresence>
        {error !== null && (
          <motion.div
            key="toast"
            className="toast"
            role="alert"
            onClick={() => setError(null)}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {personaManagerOpen && (
          <PersonaManager
            key="persona-manager"
            personas={personas}
            onClose={() => setPersonaManagerOpen(false)}
            onChanged={loadPersonas}
            onError={setError}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteId !== null && (
          <ConfirmDialog
            key="confirm-delete"
            title="Delete conversation"
            message="This conversation and its messages will be permanently deleted."
            onConfirm={confirmDelete}
            onCancel={() => setConfirmDeleteId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
