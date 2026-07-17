interface AILoaderProps {
  size?: number;
  text?: string;
  fullscreen?: boolean;
}

export function AILoader({
  size = 180,
  text = "Generating",
  fullscreen = true,
}: AILoaderProps) {
  const letters = text.split("");

  return (
    <div
      className={fullscreen ? "ai-loader ai-loader--fullscreen" : "ai-loader"}
      role="status"
      aria-label={text}
    >
      <div className="ai-loader__stage" style={{ width: size, height: size }}>
        <span className="ai-loader__text" aria-hidden>
          {letters.map((letter, index) => (
            <span
              key={index}
              className="ai-loader__letter"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {letter}
            </span>
          ))}
        </span>
        <div className="ai-loader__ring" aria-hidden />
      </div>
    </div>
  );
}
