"use client";

import { useEffect, useRef, useState } from "react";
import { PrivateFeedbackView } from "@/components/debate/PrivateFeedbackView";

interface Props {
  challengeId: string;
  initialFeedback: string | null | undefined;
}

/**
 * Shows private feedback for a participant.
 * If feedback is missing, polls the server until it's ready (max ~90s).
 */
export function PrivateFeedbackSection({ challengeId, initialFeedback }: Props) {
  const [feedback, setFeedback] = useState<string | null>(
    initialFeedback && initialFeedback.length > 20 ? initialFeedback : null,
  );
  const [polling, setPolling] = useState(!feedback);
  const attemptsRef = useRef(0);
  const MAX_ATTEMPTS = 18; // 18 × 5s = 90s

  useEffect(() => {
    if (feedback) return;

    const interval = setInterval(async () => {
      attemptsRef.current += 1;
      if (attemptsRef.current > MAX_ATTEMPTS) {
        clearInterval(interval);
        setPolling(false);
        return;
      }
      try {
        const res = await fetch(`/api/debates/${challengeId}/private-feedback`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.feedback) {
          setFeedback(json.feedback as string);
          setPolling(false);
          clearInterval(interval);
        }
        // if json.pending, keep polling
      } catch {
        // network error — keep polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [challengeId, feedback]);

  if (feedback) {
    return <PrivateFeedbackView text={feedback} />;
  }

  if (polling) {
    return (
      <div className="flex items-center gap-2 py-3">
        <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin shrink-0" />
        <p className="text-sm text-foreground-muted">Generating your feedback…</p>
      </div>
    );
  }

  return (
    <p className="text-sm text-foreground-muted italic">
      Feedback could not be generated. Try refreshing in a moment.
    </p>
  );
}
