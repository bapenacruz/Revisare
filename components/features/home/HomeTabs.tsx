"use client";

import { useState } from "react";
import { Radio, Star, Globe, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveFeed } from "./LiveFeed";
import { FeaturedFeed } from "./FeaturedFeed";
import { YourDebatesFeed } from "./YourDebatesFeed";
import { OpenChallengesFeed } from "./OpenChallengesFeed";

export type LiveDebateItem = {
  id: string;
  challengeId: string;
  motion: string;
  ranked: boolean;
  debaterA: { username: string };
  debaterB: { username: string };
  category: { label: string; emoji: string };
};

interface HomeTabsProps {
  liveCount: number;
  initialLive: LiveDebateItem[];
  initialLiveCursor: string | null;
}

const TABS = [
  { id: "live", icon: Radio, label: "Live Now" },
  { id: "featured", icon: Star, label: "Featured" },
  { id: "open", icon: Globe, label: "Open Challenges" },
  { id: "yours", icon: User, label: "Your Debates" },
] as const;

export function HomeTabs({ liveCount, initialLive, initialLiveCursor }: HomeTabsProps) {
  const [activeTab, setActiveTab] = useState(1);

  return (
    <div>
      {/* Tab Bar */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-7xl flex">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const active = activeTab === i;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(i)}
                aria-label={tab.label}
                className={cn(
                  "relative flex-1 flex items-center justify-center h-12 transition-colors duration-150",
                  active ? "text-foreground" : "text-foreground-subtle hover:text-foreground-muted"
                )}
              >
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className="transition-all duration-150" />
                  {i === 0 && liveCount > 0 && (
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

      {/*
        Panels use display:none (Tailwind `hidden`) for inactive tabs.
        This is the most reliable approach on Android Chrome:
        - Elements with display:none are completely excluded from the hit-test tree
        - No z-index stacking issues, no pointer-events quirks
        - Components stay mounted so scroll/fetch state is preserved
      */}
      <div style={{ minHeight: "calc(100svh - 8rem)" }}>
        <div className={activeTab !== 0 ? "hidden" : "h-full"}>
          <LiveFeed initialItems={initialLive} initialCursor={initialLiveCursor} />
        </div>
        <div className={activeTab !== 1 ? "hidden" : "h-full"}>
          <FeaturedFeed />
        </div>
        <div className={activeTab !== 2 ? "hidden" : "h-full"}>
          <OpenChallengesFeed />
        </div>
        <div className={activeTab !== 3 ? "hidden" : "h-full"}>
          <YourDebatesFeed />
        </div>
      </div>
    </div>
  );
}
