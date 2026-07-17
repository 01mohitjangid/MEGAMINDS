import { useState, type KeyboardEvent } from "react";
import { SendIcon, StopIcon } from "../icons";

interface ComposerProps {
  streaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

/** Message input. Enter sends; Shift+Enter inserts a newline. While the AI is
 *  streaming, the send button becomes a Stop button. */
export function Composer({ streaming, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer">
      <div className="composer__box">
        <span className="composer__mark" aria-hidden>✦</span>
        <textarea
          className="composer__input"
          placeholder="Message MegaMinds…"
          value={value}
          rows={1}
          disabled={streaming}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {streaming ? (
          <button
            className="composer__send composer__send--stop"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
          >
            <StopIcon size={16} />
          </button>
        ) : (
          <button
            className="composer__send"
            onClick={submit}
            disabled={value.trim() === ""}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <SendIcon size={16} />
          </button>
        )}
      </div>
      <p className="composer__hint">Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}
