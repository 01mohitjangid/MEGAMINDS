import { useState, type KeyboardEvent } from "react";

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
      <textarea
        className="composer__input"
        placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
        value={value}
        rows={1}
        disabled={streaming}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {streaming ? (
        <button className="btn btn--danger composer__send" onClick={onStop}>
          ■ Stop
        </button>
      ) : (
        <button
          className="btn composer__send"
          onClick={submit}
          disabled={value.trim() === ""}
        >
          Send
        </button>
      )}
    </div>
  );
}
