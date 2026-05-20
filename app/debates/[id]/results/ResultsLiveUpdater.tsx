"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";

interface Props {
  challengeId: string;
  /** true while AI judging is still pending */
  pending: boolean;
}

/**
 * Invisible component that refreshes the results server component when
 * AI judging finishes.  Uses Pusher for an instant update and polls every
 * 5 s as a fallback (e.g. when Ably key is absent).
 */
export function ResultsLiveUpdater({ challengeId, pending }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!pending) return;

    const refresh = () => router.refresh();

    // Fallback polling
    const poll = setInterval(refresh, 5000);

    // Instant update via Ably/Pusher
    const pusher = getPusherClient();
    if (pusher) {
      const channel = pusher.subscribe(`debate-${challengeId}`);
      channel.bind("debate:state-changed", refresh);
    }

    return () => {
      clearInterval(poll);
      const p = getPusherClient();
      if (p) p.unsubscribe(`debate-${challengeId}`);
    };
  }, [challengeId, pending, router]);

  return null;
}
