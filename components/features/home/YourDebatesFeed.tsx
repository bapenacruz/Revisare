"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

type YourDebateItem = {
  id: string;
  challengeId: string;
  motion: string;
  ranked: boolean;
  status: string;
  winnerId: string | null;
  completedAt: string | null;
  startedAt: string | null;
  debaterA: { id: string; username: string };
  debaterB: { id: string; username: string };
  category: { label: string; emoji: string };
};

const STATUS_BADGE: Record<string, { label: string; variant: "live" | "success" | "default" | "warning" }> = {
  active: { label: "LIVE", variant: "live" },
  completed: { label: "Completed", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
};

export function YourDebatesFeed() {
  const { data: session, status: authStatus } = useSession();
  const [items, setItems] = useState<YourDebateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const cursorRef = useRef<string | null | undefined>(undefined);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || cursorRef.current === null) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const url =
        cursorRef.current !== undefined
          ? `/api/home/yours?cursor=${cursorRef.current}`
          : `/api/home/yours`;
      const res = await fetch(url);
      if (res.status === 401) return;
      if (!res.ok) return;
      const { items: next, nextCursor } = (await res.json()) as {
        items: YourDebateItem[];
        nextCursor: string | null;
      };
      setItems((prev) => {
        if (prev.length === 0 && next.length === 0) setEmpty(true);
        return [...prev, ...next];
      });
      cursorRef.current = nextCursor;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Trigger initial load once we know the user is authenticated
  useEffect(() => {
    if (authStatus === "authenticated") loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Not signed in
  if (authStatus === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
        <Swords size={36} className="opacity-25 text-foreground-muted" />
        <p className="text-sm text-foreground-muted">
          Sign in to track your debate history.
        </p>
        <Link href="/auth/login">
          <Button size="sm">Sign In</Button>
        </Link>
      </div>
    );
  }

  // Session loading
  if (authStatus === "loading") {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (!loading && empty) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 gap-3" style={{ minHeight: "calc(100svh - 8rem)" }}>
        <Swords size={36} className="opacity-25 text-foreground-muted" />
        <p className="text-sm text-foreground-muted">You haven&apos;t debated yet.</p>
      </div>
    );
  }

  const userId = session?.user?.id;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 pb-24">
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-[--radius-lg] bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((debate) => {
            const isCompleted = debate.status === "completed";
            const debateHref = isCompleted ? `/debates/${debate.challengeId}/results` : `/debates/${debate.challengeId}`;
            const statusInfo = STATUS_BADGE[debate.status] ?? {
              label: debate.status,
              variant: "default" as const,
            };

            return (
              <Link key={debate.id} href={debateHref}>
                <Card interactive className="h-full">
                  <CardBody className="flex flex-col gap-3 p-4">
                    {/* Top row: category + status */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default" size="sm">
                        {debate.category.emoji} {debate.category.label}
                      </Badge>
                      <Badge variant={statusInfo.variant} size="sm">
                        {statusInfo.label}
                      </Badge>
                      {debate.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                    </div>

                    {/* Motion */}
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-3 flex-1">
                      {debate.motion}
                    </p>

                    {/* Participants */}
                    <div className="flex flex-col gap-1">
                      {[debate.debaterA, debate.debaterB].map((p) => {
                        const isWinner = debate.winnerId === p.id;
                        return (
                          <div key={p.id} className={`flex items-center gap-1.5 text-xs ${isWinner ? "font-semibold text-foreground" : "text-foreground-muted opacity-70"}`}>
                            {isWinner && <Trophy size={11} className="text-accent shrink-0" />}
                            {!isWinner && <span className="w-[11px] shrink-0" />}
                            <Avatar initial={p.username[0].toUpperCase()} size="xs" />
                            <span className="truncate">{p.username}</span>
                          </div>
                        );
                      })}
                    </div>
                    {isCompleted && !debate.winnerId && (
                      <p className="text-xs text-foreground-subtle">Draw / No verdict</p>
                    )}
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />

      {loading && items.length > 0 && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
