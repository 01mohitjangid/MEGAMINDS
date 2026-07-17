import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { Message } from "../../lib/api";

interface MessageThreadProps {
  messages: Message[];
  streaming: boolean;
  streamingText: string;
  personaName: string;
}

const rise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 380, damping: 32 },
} as const;

function AssistantCard({
  personaName,
  children,
}: {
  personaName: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div className="ai-card" {...rise}>
      <div className="ai-card__head">
        <span className="ai-card__avatar" aria-hidden />
        <span className="ai-card__name">{personaName}</span>
      </div>
      <div className="ai-card__body">{children}</div>
    </motion.div>
  );
}

export function MessageThread({
  messages,
  streaming,
  streamingText,
  personaName,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, streamingText]);

  return (
    <div className="thread">
      <div className="thread__inner">
        {messages.map((m) =>
          m.role === "user" ? (
            <motion.div key={m.id} className="msg-pill" {...rise}>
              {m.content}
            </motion.div>
          ) : (
            <AssistantCard key={m.id} personaName={personaName}>
              {m.content}
            </AssistantCard>
          ),
        )}

        {streaming && (
          <AssistantCard personaName={personaName}>
            {streamingText === "" ? (
              <span className="thinking">
                <span className="dot-typing" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                Thinking…
              </span>
            ) : (
              <>
                {streamingText}
                <span className="cursor" aria-hidden />
              </>
            )}
          </AssistantCard>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
