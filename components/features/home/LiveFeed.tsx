"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import type { LiveDebateItem } from "./HomeTabs";

interface LiveFeedProps {
  initialItems: LiveDebateItem[];
  initialCursor: string | null;
}

export function LiveFeed({ initialItems, initialCursor }: LiveFeedProps) {
  const [items, setItems] = useState<LiveDebateItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const cursorRef = useRef<string | null>(initialCursor);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    // null = no more pages; stop
    if (loadingRef.current || cursorRef.current === null) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const url = cursorRef.current
        ? `/api/home/live?cursor=${cursorRef.current}`
        : `/api/home/live`;
      const res = await fetch(url);
      if (!res.ok) return;
      const { items: next, nextCursor } = (await res.json()) as {
        items: LiveDebateItem[];
        nextCursor: string | null;
      };
      setItems((prev) => [...prev, ...next]);
      cursorRef.current = nextCursor;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

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

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "calc(100svh - 8rem)" }}>
        <Radio size={36} className="mb-4 opacity-25 text-foreground-muted" />
        <p className="text-sm text-foreground-muted">
          No live debates right now — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 pb-24">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((debate) => (
          <Link key={debate.id} href={`/debates/${debate.challengeId}`}>
            <Card interactive className="h-full">
              <CardBody className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="default" size="sm">
                    {debate.category.emoji} {debate.category.label}
                  </Badge>
                  <Badge variant="live" size="sm">LIVE</Badge>
                  {debate.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                </div>

                <p className="text-sm font-medium text-foreground leading-snug line-clamp-3 flex-1">
                  {debate.motion}
                </p>

                <div className="flex flex-col gap-1">
                  {[debate.debaterA, debate.debaterB].map((p) => (
                    <div key={p.username} className="flex items-center gap-1.5 text-xs text-foreground-muted">
                      <Avatar initial={p.username[0].toUpperCase()} size="xs" />
                      <span className="truncate">{p.username}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <div ref={sentinelRef} className="h-4" />

      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
