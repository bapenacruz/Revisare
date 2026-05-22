"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Megaphone, Eye, MessageSquare } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

type FeaturedDebateItem = {
  id: string;
  challengeId: string;
  motion: string;
  ranked: boolean;
  winnerId: string | null;
  audienceLeaderId: string | null;
  completedAt: string | null;
  viewCount: number;
  commentCount: number;
  debaterA: { id: string; username: string; avatarUrl: string | null };
  debaterB: { id: string; username: string; avatarUrl: string | null };
  category: { label: string; emoji: string };
};

type AdItem = {
  id: string;
  motion: string;
  proponentName: string;
  opponentName: string;
  linkUrl: string | null;
};

type BannerItem = {
  id: string;
  imageDataUrl: string;
  linkUrl: string | null;
  altText: string | null;
};

type FeedItem =
  | { type: "debate"; data: FeaturedDebateItem }
  | { type: "ad"; data: AdItem }
  | { type: "banner"; data: BannerItem };

// Ensure a URL is absolute (has http/https scheme)
function ensureAbsoluteUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

// Inject one ad every 5 debate cards, cycling through available ads
// Also inject one banner at position 2 if available
function buildFeed(debates: FeaturedDebateItem[], ads: AdItem[], banners: BannerItem[]): FeedItem[] {
  const result: FeedItem[] = [];
  let adIdx = 0;
  let bannerInjected = false;
  for (let i = 0; i < debates.length; i++) {
    // Inject banner after 2nd debate card (once)
    if (!bannerInjected && banners.length > 0 && i === 2) {
      result.push({ type: "banner", data: banners[Math.floor(Math.random() * banners.length)] });
      bannerInjected = true;
    }
    result.push({ type: "debate", data: debates[i] });
    if (ads.length > 0 && (i + 1) % 5 === 0) {
      result.push({ type: "ad", data: ads[adIdx % ads.length] });
      adIdx++;
    }
  }
  // If not enough debates to reach position 2, append banner at end
  if (!bannerInjected && banners.length > 0 && debates.length > 0) {
    result.push({ type: "banner", data: banners[Math.floor(Math.random() * banners.length)] });
  }
  return result;
}

export function FeaturedFeed() {
  const [items, setItems] = useState<FeaturedDebateItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  // undefined = first page not yet fetched; null = exhausted; string = next cursor
  const cursorRef = useRef<string | null | undefined>(undefined);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch active ads and banners once on mount
  useEffect(() => {
    fetch("/api/home/ads")
      .then((r) => r.json())
      .then(({ ads: fetchedAds, banners: fetchedBanners }: { ads: AdItem[]; banners: BannerItem[] }) => {
        setAds(fetchedAds ?? []);
        setBanners(fetchedBanners ?? []);
      })
      .catch(() => {});
  }, []);

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
      <div className="flex flex-col flex-1 items-center justify-center text-center px-6">
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
          {buildFeed(items, ads, banners).map((item, idx) => {
            if (item.type === "banner") {
              const b = item.data;
              const inner = (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.imageDataUrl} alt={b.altText ?? ""} className="w-full h-full object-cover rounded-[--radius-lg]" style={{ minHeight: "8rem", maxHeight: "12rem" }} />
              );
              return b.linkUrl ? (
                <a key={`banner-${b.id}-${idx}`} href={ensureAbsoluteUrl(b.linkUrl)} target="_blank" rel="noopener noreferrer"
                  className="block overflow-hidden rounded-[--radius-lg] border border-border">
                  {inner}
                </a>
              ) : (
                <div key={`banner-${b.id}-${idx}`} className="overflow-hidden rounded-[--radius-lg] border border-border">
                  {inner}
                </div>
              );
            }

            if (item.type === "ad") {
              const ad = item.data;
              const inner = (
                <Card interactive className="h-full border-brand/20 bg-surface">
                  <CardBody className="flex flex-col gap-3 p-4">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-brand/10 text-brand border-brand/20">
                        <Megaphone size={9} /> Sponsored
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-3 flex-1">
                      {ad.motion}
                    </p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Avatar initial={ad.proponentName[0].toUpperCase()} size="xs" />
                        <span className="truncate">{ad.proponentName}</span>
                        <span title="Winner">🏆</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-foreground-muted opacity-70">
                        <Avatar initial={ad.opponentName[0].toUpperCase()} size="xs" />
                        <span className="truncate">{ad.opponentName}</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
              return ad.linkUrl ? (
                <a key={`ad-${ad.id}-${idx}`} href={ensureAbsoluteUrl(ad.linkUrl)} target="_blank" rel="noopener noreferrer">{inner}</a>
              ) : (
                <div key={`ad-${ad.id}-${idx}`}>{inner}</div>
              );
            }

            const debate = item.data;
            return (
              <Link key={debate.id} href={`/debates/${debate.challengeId}/results`}>
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
                        const isAudiencePick = debate.audienceLeaderId === p.id;
                        return (
                          <div key={p.id} className={`flex items-center gap-1.5 text-xs ${isWinner ? "font-semibold text-foreground" : "text-foreground-muted opacity-70"}`}>
                            <Avatar initial={p.username[0].toUpperCase()} src={p.avatarUrl ?? undefined} size="xs" />
                            <span className="truncate">{p.username}</span>
                            {isWinner && <span title="AI Winner">🏆</span>}
                            {isAudiencePick && <span title="Audience Pick">🥇</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-foreground-muted">
                      <span className="flex items-center gap-1"><Eye size={11} />{debate.viewCount.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={11} />{debate.commentCount.toLocaleString()}</span>
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
