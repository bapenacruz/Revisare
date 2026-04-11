"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Trophy, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

type FeaturedDebateItem = {
  id: string;
  challengeId: string;
  motion: string;
  ranked: boolean;
  winnerId: string | null;
  completedAt: string | null;
  debaterA: { id: string; username: string };
  debaterB: { id: string; username: string };
  category: { label: string; emoji: string };
};

export function FeaturedFeed() {
  const [items, setItems] = useState<FeaturedDebateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  // undefined = first page not yet fetched; null = exhausted; string = next cursor
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
          ? `/api/home/featured?cursor=${cursorRef.current}`
          : `/api/home/featured`;
      const res = await fetch(url);
      if (!res.ok) return;
      const { items: next, nextCursor } = (await res.json()) as {
        items: FeaturedDebateItem[];
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

  // Initial load
  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (!loading && empty) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <Sparkles size={36} className="mb-4 opacity-25 text-foreground-muted" />
        <p className="text-sm text-foreground-muted">No featured debates yet.</p>
      </div>
    );
  }

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
            return (
              <Link key={debate.id} href={`/debates/${debate.challengeId}`}>
                <Card interactive className="h-full">
                  <CardBody className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default" size="sm">
                        {debate.category.emoji} {debate.category.label}
                      </Badge>
                      {debate.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                    </div>

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
