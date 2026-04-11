"use client";

const SCORE_KEYS = ["factuality", "evidence_quality", "argument_strength", "rebuttal_quality", "clarity", "persuasiveness"];

export function PrivateFeedbackView({ text }: { text: string }) {
  const lines = text.split(/\n/);
  const scores: { label: string; value: number }[] = [];
  const narrative: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const scoreMatch = trimmed.match(/^(\w+):\s*(\d+)/);
    if (scoreMatch && SCORE_KEYS.includes(scoreMatch[1])) {
      scores.push({ label: scoreMatch[1].replace(/_/g, " "), value: parseInt(scoreMatch[2], 10) });
    } else {
      narrative.push(trimmed);
    }
  }

  if (scores.length === 0) {
    return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {scores.map(({ label, value }) => (
          <div key={label} className="grid grid-cols-[10rem_1fr_2rem] items-center gap-2">
            <span className="text-xs text-foreground-muted capitalize">{label}</span>
            <div className="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${value < 3 ? "bg-danger" : value < 5 ? "bg-amber-500" : "bg-brand"}`}
                style={{ width: `${value * 10}%` }}
              />
            </div>
            <span className={`text-xs font-bold tabular-nums text-right ${value < 3 ? "text-danger" : value < 5 ? "text-amber-500" : "text-foreground"}`}>{value}</span>
          </div>
        ))}
      </div>
      {narrative.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
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
      )}
    </div>
  );
}
