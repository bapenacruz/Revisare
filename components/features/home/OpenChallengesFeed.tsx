"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Globe, Clock, Swords, Bell } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ChallengeItem = {
  id: string;
  type: string;
  motion: string;
  ranked: boolean;
  format: string;
  status: string;
  creatorId: string;
  targetId: string | null;
  expiresAt: string | null;
  createdAt: string;
  creator: { id: string; username: string };
  target: { id: string; username: string } | null;
  category: { label: string; emoji: string };
};

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h left`;
  return `${m}m left`;
}

function ChallengeCard({ challenge, invite = false }: { challenge: ChallengeItem; invite?: boolean }) {
  const expiry = timeLeft(challenge.expiresAt);

  return (
    <Link href={`/challenges/${challenge.id}/lobby`}>
      <Card
        interactive
        className={cn(
          "h-full",
          invite && "border-brand/50 bg-brand-dim/40"
        )}
      >
        <CardBody className="flex flex-col gap-3 p-4">
          {/* Invite banner */}
          {invite && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
              <Bell size={12} />
              You&apos;ve been challenged
            </div>
          )}

          {/* Category row */}
          <div className="flex items-center justify-between flex-wrap gap-1">
            <Badge variant="default" size="sm">
              {challenge.category.emoji} {challenge.category.label}
            </Badge>
            <div className="flex items-center gap-1.5">
              {challenge.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
              <Badge variant="default" size="sm" className="capitalize">
                {challenge.format}
              </Badge>
            </div>
          </div>

          {/* Motion */}
          <p className="text-sm font-medium text-foreground leading-snug line-clamp-3 flex-1">
            {challenge.motion}
          </p>

          {/* Participants */}
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <Avatar initial={challenge.creator.username[0].toUpperCase()} size="xs" />
            <span className="truncate max-w-[5rem]">{challenge.creator.username}</span>
            <span className="font-bold text-foreground-subtle shrink-0">VS</span>
            {challenge.target ? (
              <>
                <Avatar initial={challenge.target.username[0].toUpperCase()} size="xs" />
                <span className="truncate max-w-[5rem]">{challenge.target.username}</span>
              </>
            ) : (
              <span className="italic text-foreground-subtle">Open slot</span>
            )}
          </div>

          {/* Footer */}
          {expiry && (
            <div className="flex items-center gap-1 text-xs text-foreground-subtle pt-1 border-t border-border">
              <Clock size={10} />
              {expiry}
            </div>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}

export function OpenChallengesFeed() {
  const { status: authStatus } = useSession();
  const [directInvites, setDirectInvites] = useState<ChallengeItem[]>([]);
  const [openItems, setOpenItems] = useState<ChallengeItem[]>([]);
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
          ? `/api/home/challenges?cursor=${cursorRef.current}`
          : `/api/home/challenges`;
      const res = await fetch(url);
      if (res.status === 401) return;
      if (!res.ok) return;
      const data = (await res.json()) as {
        directInvites: ChallengeItem[];
        openItems: ChallengeItem[];
        nextCursor: string | null;
      };

      if (!cursorRef.current) {
        // First page — set direct invites
        setDirectInvites(data.directInvites);
      }
      setOpenItems((prev) => {
        const next = [...prev, ...data.openItems];
        if (data.directInvites.length === 0 && next.length === 0 && !cursorRef.current) setEmpty(true);
        return next;
      });
      cursorRef.current = data.nextCursor;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (authStatus === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
        <Globe size={36} className="opacity-25 text-foreground-muted" />
        <p className="text-sm text-foreground-muted">Sign in to see open challenges.</p>
        <Link href="/auth/login">
          <Button size="sm">Sign In</Button>
        </Link>
      </div>
    );
  }

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
        <p className="text-sm text-foreground-muted">No open challenges right now.</p>
      </div>
    );
  }

  const isFirstLoad = loading && directInvites.length === 0 && openItems.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 pb-24 space-y-6">
      {isFirstLoad ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-[--radius-lg] bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Direct Invites ── */}
          {directInvites.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-brand mb-3 flex items-center gap-2">
                <Bell size={13} />
                Direct Invites
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {directInvites.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} invite />
                ))}
              </div>
            </section>
          )}

          {/* ── Open Challenges ── */}
          {openItems.length > 0 && (
            <section>
              {directInvites.length > 0 && (
                <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground-subtle mb-3 flex items-center gap-2">
                  <Globe size={13} />
                  Open to Join
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {openItems.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div ref={sentinelRef} className="h-4" />

      {loading && !isFirstLoad && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
