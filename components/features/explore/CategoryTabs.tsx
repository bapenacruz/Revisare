"use client";

import { useState, useRef, useCallback } from "react";
import { Radio, Globe, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

const TABS = [
  { id: "live", icon: Radio, label: "Live" },
  { id: "recent", icon: Clock, label: "Recent Debates" },
  { id: "open", icon: Globe, label: "Open Challenges" },
] as const;

type LiveDebate = {
  id: string;
  challengeId: string;
  motion: string;
  ranked: boolean;
  debaterA: { username: string };
  debaterB: { username: string };
};

type OpenChallenge = {
  id: string;
  motion: string;
  ranked: boolean;
  format: string;
  creator: { username: string };
};

type PastDebate = {
  id: string;
  challengeId: string;
  motion: string;
  debaterA: { username: string };
  debaterB: { username: string };
};

interface CategoryTabsProps {
  live: LiveDebate[];
  open: OpenChallenge[];
  recent: PastDebate[];
  categoryLabel: string;
}

export function CategoryTabs({ live, open, recent, categoryLabel }: CategoryTabsProps) {
  const [activeTab, setActiveTab] = useState(1);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
      setActiveTab((t) => (dx < 0 ? Math.min(t + 1, TABS.length - 1) : Math.max(t - 1, 0)));
    }
  }, []);

  return (
    <div className="flex flex-col">
      {/* Tab Bar */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const active = activeTab === i;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(i)}
                aria-label={tab.label}
                className={cn(
                  "relative flex-1 flex items-center justify-center h-12 transition-colors duration-150",
                  active ? "text-foreground" : "text-foreground-subtle hover:text-foreground-muted"
                )}
              >
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className="transition-all duration-150" />
                  {/* Live dot */}
                  {i === 0 && live.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-danger border border-background" />
                  )}
                </span>
                <span
                  className={cn(
                    "absolute bottom-0 inset-x-6 h-0.5 rounded-full bg-brand transition-opacity duration-150",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Swiper */}
      <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: `translateX(calc(-${activeTab} * 100%))` }}
        >
          {/* Panel 0 — Live */}
          <div className="w-full shrink-0 min-h-[50vh]">
            {live.length === 0 ? (
              <EmptyState text="No live debates right now." />
            ) : (
              <div className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {live.map((d) => (
                  <Link key={d.id} href={`/debates/${d.challengeId}`}>
                    <Card interactive className="h-full">
                      <CardBody className="flex flex-col gap-3 p-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="live" size="sm">LIVE</Badge>
                          {d.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                        </div>
                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-3 flex-1">
                          {d.motion}
                        </p>
                        <div className="flex flex-col gap-1">
                          {[d.debaterA, d.debaterB].map((p) => (
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
            )}
          </div>

          {/* Panel 1 — Recent Debates */}
          <div className="w-full shrink-0 min-h-[50vh]">
            {recent.length === 0 ? (
              <EmptyState text="No completed debates yet." />
            ) : (
              <div className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recent.map((d) => (
                  <Link key={d.id} href={`/debates/${d.challengeId}/results`}>
                            </div>
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Panel 2 — Open Challenges */}
          <div className="w-full shrink-0 min-h-[50vh]">
            {open.length === 0 ? (
              <EmptyState text="No open challenges right now.">
                <Link href="/challenges/new" className="text-sm text-brand hover:text-brand-hover font-medium">
                  Post one in {categoryLabel} →
                </Link>
              </EmptyState>
            ) : (
              <div className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {open.map((c) => (
                  <Link key={c.id} href={`/challenges/${c.id}/lobby`}>
                    <Card interactive className="h-full">
                      <CardBody className="flex flex-col gap-3 p-4">
                        <div className="flex items-center gap-1.5">
                          {c.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                          <Badge variant="default" size="sm" className="capitalize">{c.format}</Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-3 flex-1">
                          {c.motion}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                          <Avatar initial={c.creator.username[0].toUpperCase()} size="xs" />
                          <span className="truncate">{c.creator.username}</span>
                          <span className="italic text-foreground-subtle ml-auto">Open slot</span>
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6 gap-3">
      <p className="text-sm text-foreground-muted">{text}</p>
      {children}
    </div>
  );
}
