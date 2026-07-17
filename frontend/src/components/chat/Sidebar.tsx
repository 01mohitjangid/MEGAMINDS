import { useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Conversation } from "../../lib/api";
import { PencilIcon, PlusIcon, SparklesIcon, TrashIcon, XIcon } from "../icons";

interface SidebarProps {
  conversations: Conversation[];
  activeId: number | null;
  username: string;
  loading: boolean;
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
  conversations,
  activeId,
  username,
  loading,
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
          <span className="brand">
            <span className="brand__orb" aria-hidden />
            MegaMinds
          </span>
          <button
            className="sidebar__close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="sidebar__buttons">
          <button className="btn btn--block" onClick={onNewChat}>
            <PlusIcon size={15} /> New chat
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onManagePersonas}>
            <SparklesIcon size={14} /> Manage personas
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
          <AnimatePresence initial={false}>
            {conversations.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
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
                      aria-label={`Rename ${c.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(c);
                      }}
                    >
                      <PencilIcon size={13} />
                    </button>
                    <button
                      className="conv-item__btn conv-item__btn--danger"
                      title="Delete"
                      aria-label={`Delete ${c.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                    >
                      <TrashIcon size={13} />
                    </button>
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </nav>

      <footer className="sidebar__footer">
        <span className="sidebar__user">
          <span className="sidebar__avatar" aria-hidden>
            {username.slice(0, 1).toUpperCase()}
          </span>
          {username}
        </span>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>
          Log out
        </button>
      </footer>
    </aside>
  );
}
