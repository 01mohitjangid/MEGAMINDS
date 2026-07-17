import { useState, type KeyboardEvent } from "react";
import type { Conversation, Persona } from "../../lib/api";

interface SidebarProps {
  personas: Persona[];
  conversations: Conversation[];
  activeId: number | null;
  newPersonaId: number | null;
  username: string;
  loading: boolean;
  onPersonaChange: (personaId: number | null) => void;
  onNewChat: () => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
  onManagePersonas: () => void;
  onLogout: () => void;
  onClose: () => void;
}

/** Left column: persona picker + New chat, the conversation list, and account. */
export function Sidebar({
  personas,
  conversations,
  activeId,
  newPersonaId,
  username,
  loading,
  onPersonaChange,
  onNewChat,
  onSelect,
  onDelete,
  onRename,
  onManagePersonas,
  onLogout,
  onClose,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  function startRename(c: Conversation) {
    setEditingId(c.id);
    setDraft(c.title);
  }

  function commitRename() {
    if (editingId !== null && draft.trim() !== "") {
      onRename(editingId, draft.trim());
    }
    setEditingId(null);
  }

  function handleRenameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditingId(null);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="sidebar__brand">
          <span className="badge">MegaMinds</span>
          <button
            className="sidebar__close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <label className="sidebar__field">
          <span className="auth-field__label">Persona for new chat</span>
          <select
            className="auth-input"
            value={newPersonaId ?? ""}
            onChange={(e) =>
              onPersonaChange(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">No persona</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_default ? "" : " (custom)"}
              </option>
            ))}
          </select>
        </label>

        <div className="sidebar__buttons">
          <button className="btn btn--block" onClick={onNewChat}>
            + New chat
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onManagePersonas}>
            Manage personas
          </button>
        </div>
      </div>

      <nav className="sidebar__list">
        {loading ? (
          <div className="skeletons">
            <span className="skeleton" />
            <span className="skeleton" />
            <span className="skeleton" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="sidebar__empty">No conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={`conv-item${c.id === activeId ? " conv-item--active" : ""}`}
              onClick={() => editingId !== c.id && onSelect(c.id)}
            >
              {editingId === c.id ? (
                <input
                  className="conv-item__edit"
                  value={draft}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKey}
                />
              ) : (
                <span className="conv-item__title">{c.title}</span>
              )}

              {editingId !== c.id && (
                <span className="conv-item__actions">
                  <button
                    className="conv-item__btn"
                    title="Rename"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(c);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    className="conv-item__btn conv-item__btn--danger"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          ))
        )}
      </nav>

      <footer className="sidebar__footer">
        <span className="sidebar__user">{username}</span>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>
          Log out
        </button>
      </footer>
    </aside>
  );
}
