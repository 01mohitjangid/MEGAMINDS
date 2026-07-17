import { useEffect, useRef } from "react";
import type { Message } from "../../lib/api";

interface MessageThreadProps {
  messages: Message[];
  streaming: boolean;
  streamingText: string;
}

/** The scrolling conversation view. Auto-scrolls to the newest content and
 *  renders the in-progress assistant reply as it types in. */
export function MessageThread({
  messages,
  streaming,
  streamingText,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, streamingText]);

  if (messages.length === 0 && !streaming) {
    return (
      <div className="thread thread--empty">
        <p className="subtitle">Send a message to start the conversation.</p>
      </div>
    );
  }

  return (
    <div className="thread">
      {messages.map((m) => (
        <div key={m.id} className={`bubble bubble--${m.role}`}>
          <span className="bubble__role">{m.role === "user" ? "You" : "AI"}</span>
          <div className="bubble__content">{m.content}</div>
        </div>
      ))}

      {streaming && (
        <div className="bubble bubble--assistant">
          <span className="bubble__role">AI</span>
          <div className="bubble__content">
            {streamingText === "" ? (
              <span className="bubble__thinking">
                <span className="dot-typing" />
                Thinking…
              </span>
            ) : (
              <>
                {streamingText}
                <span className="cursor" aria-hidden />
              </>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
