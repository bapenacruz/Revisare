"use client";

const SCORE_KEYS = ["factuality", "evidence_quality", "argument_strength", "rebuttal_quality", "clarity", "persuasiveness"];

export function PrivateFeedbackView({ text }: { text: string }) {
  const lines = text.split(/\n/);
  const narrative: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip raw score lines (e.g. "factuality: 7")
    const scoreMatch = trimmed.match(/^(\w+):\s*(\d+)$/);
    if (scoreMatch && SCORE_KEYS.includes(scoreMatch[1])) continue;
    narrative.push(trimmed);
  }

  if (narrative.length === 0) {
    return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {narrative.map((line, i) => {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0 && colonIdx < 30) {
          const label = line.slice(0, colonIdx).trim();
          const content = line.slice(colonIdx + 1).trim();
          return (
            <div key={i}>
              <span className="text-xs font-semibold text-foreground">{label}: </span>
              <span className="text-sm text-foreground-muted">{content}</span>
            </div>
          );
        }
        return <p key={i} className="text-sm text-foreground-muted">{line}</p>;
      })}
    </div>
  );
}

