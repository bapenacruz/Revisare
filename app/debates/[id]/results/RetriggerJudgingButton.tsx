"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  challengeId: string;
  completedAtIso: string;
}

const INITIAL_WAIT_MS = 5 * 60 * 1000; // 5 min before button appears
const COOLDOWN_MS = 5 * 60 * 1000;     // 5 min cooldown after triggering
const LS_KEY = (id: string) => `judging-triggered-${id}`;

export function RetriggerJudgingButton({ challengeId, completedAtIso }: Props) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());
  const [triggering, setTriggering] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Re-render every 5s to update countdown display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const completedAtMs = new Date(completedAtIso).getTime();
  const elapsedSinceCompleted = now - completedAtMs;
  const initialReady = elapsedSinceCompleted >= INITIAL_WAIT_MS;

  const lastTriggered = typeof window !== "undefined"
    ? parseInt(localStorage.getItem(LS_KEY(challengeId)) ?? "0", 10)
    : 0;
  const cooldownElapsed = now - lastTriggered;
  const inCooldown = lastTriggered > 0 && cooldownElapsed < COOLDOWN_MS;

  if (!initialReady) {
    const waitSec = Math.ceil((INITIAL_WAIT_MS - elapsedSinceCompleted) / 1000);
    return (
      <p className="text-xs text-foreground-muted">
        AI judging check available in {waitSec}s…
      </p>
    );
  }

  async function trigger() {
    setTriggering(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/debates/${challengeId}/request-judging`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        localStorage.setItem(LS_KEY(challengeId), String(Date.now()));
        setMsg("AI judging triggered. Refresh in ~60s to see results.");
        // Refresh after 60s
        setTimeout(() => router.refresh(), 60_000);
      } else {
        setMsg(json.error ?? "Failed to trigger judging.");
      }
    } catch {
      setMsg("Network error. Please try again.");
    } finally {
      setTriggering(false);
    }
  }

  const remainingSec = inCooldown ? Math.ceil((COOLDOWN_MS - cooldownElapsed) / 1000) : 0;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <button
        onClick={trigger}
        disabled={triggering || inCooldown}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-brand/40 bg-brand/10 text-brand hover:bg-brand/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-fit"
      >
        {triggering ? (
          <>
            <span className="w-3 h-3 rounded-full border border-brand border-t-transparent animate-spin" />
            Triggering…
          </>
        ) : inCooldown ? (
          `AI judging requested — retry in ${remainingSec}s`
        ) : (
          "Request AI Judgment"
        )}
      </button>
      {msg && <p className="text-xs text-foreground-muted">{msg}</p>}
    </div>
  );
}
