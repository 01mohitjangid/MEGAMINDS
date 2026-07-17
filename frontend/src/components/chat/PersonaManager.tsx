import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ApiError, personas as personaApi, type Persona } from "../../lib/api";
import { ConfirmDialog } from "../ConfirmDialog";
import { XIcon } from "../icons";

interface PersonaManagerProps {
  personas: Persona[];
  onClose: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
}

interface FormState {
  id: number | null;
  name: string;
  description: string;
  system_prompt: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  description: "",
  system_prompt: "",
};

export function PersonaManager({
  personas,
  onClose,
  onChanged,
  onError,
}: PersonaManagerProps) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const mine = personas.filter((p) => !p.is_default);

  async function save() {
    if (form === null) return;
    if (form.name.trim() === "" || form.system_prompt.trim() === "") {
      onError("Name and system prompt are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        system_prompt: form.system_prompt.trim(),
      };
      if (form.id === null) {
        await personaApi.create(payload);
      } else {
        await personaApi.update(form.id, payload);
      }
      setForm(null);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Failed to save persona.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setConfirmDeleteId(null);
    try {
      await personaApi.remove(id);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Failed to delete persona.");
    }
  }

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        <header className="modal__header">
          <h3 className="modal__title">Manage personas</h3>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </header>

        {form === null ? (
          <>
            <div className="persona-list">
              {mine.length === 0 ? (
                <p className="subtitle">You haven't created any personas yet.</p>
              ) : (
                mine.map((p) => (
                  <div key={p.id} className="persona-row">
                    <div className="persona-row__text">
                      <span className="persona-row__name">{p.name}</span>
                      <span className="persona-row__desc">{p.description}</span>
                    </div>
                    <div className="persona-row__actions">
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() =>
                          setForm({
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            system_prompt: p.system_prompt,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => setConfirmDeleteId(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              className="btn btn--block"
              onClick={() => setForm({ ...EMPTY_FORM })}
            >
              + New persona
            </button>
          </>
        ) : (
          <div className="persona-form">
            <label className="auth-field">
              <span className="auth-field__label">Name</span>
              <input
                className="auth-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="auth-field">
              <span className="auth-field__label">Description</span>
              <input
                className="auth-input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label className="auth-field">
              <span className="auth-field__label">
                System prompt (steers the AI)
              </span>
              <textarea
                className="auth-input persona-form__prompt"
                rows={5}
                placeholder="You are a patient math tutor who explains step by step…"
                value={form.system_prompt}
                onChange={(e) =>
                  setForm({ ...form, system_prompt: e.target.value })
                }
              />
            </label>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="btn" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save persona"}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {confirmDeleteId !== null && (
          <ConfirmDialog
            key="confirm-persona-delete"
            title="Delete persona"
            message="This persona will be removed. Conversations using it stay, but lose their persona."
            onConfirm={() => remove(confirmDeleteId)}
            onCancel={() => setConfirmDeleteId(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
