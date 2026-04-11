"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, MapPin, X, Check } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const RANK_COLORS: Record<number, string> = {
  1: "text-amber-400",
  2: "text-slate-300",
  3: "text-amber-600",
};

type Player = {
  id: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  country: string | null;
};

type Category = {
  id: string;
  label: string;
  emoji: string;
  slug: string;
};

interface LeaderboardTableProps {
  players: Player[];
  categories: Category[];
}

export function LeaderboardTable({ players, categories }: LeaderboardTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [location, setLocation] = useState(searchParams.get("loc") ?? "");
  const [categorySlug, setCategorySlug] = useState(searchParams.get("cat") ?? "");
  const [, startTransition] = useTransition();

  // Filter sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftLocation, setDraftLocation] = useState("");
  const [draftCategory, setDraftCategory] = useState("");

  const activeCount = [location, categorySlug].filter(Boolean).length;

  function openSheet() {
    setDraftLocation(location);
    setDraftCategory(categorySlug);
    setSheetOpen(true);
  }

  function applyFilters() {
    setLocation(draftLocation);
    setCategorySlug(draftCategory);
    const params = new URLSearchParams(searchParams.toString());
    if (draftLocation) params.set("loc", draftLocation); else params.delete("loc");
    if (draftCategory) params.set("cat", draftCategory); else params.delete("cat");
    startTransition(() => { router.replace(`${pathname}?${params.toString()}`, { scroll: false }); });
    setSheetOpen(false);
  }

  function clearFilters() {
    setLocation(""); setCategorySlug("");
    setDraftLocation(""); setDraftCategory("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("loc"); params.delete("cat");
    startTransition(() => { router.replace(`${pathname}?${params.toString()}`, { scroll: false }); });
    setSheetOpen(false);
  }

  // Derive filtered list client-side
  const filtered = useMemo(() => {
    let list = players;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.username.toLowerCase().includes(q));
    }
    if (location.trim()) {
      const loc = location.toLowerCase();
      list = list.filter((p) => p.country?.toLowerCase().includes(loc));
    }
    return list;
  }, [players, search, location]);

  return (
    <>
    <div>
      {/* ── Search + Filter row ── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search debaters..."
            className={cn(
              "w-full h-9 pl-8 pr-3 rounded-[--radius] bg-surface border border-border text-sm",
              "text-foreground placeholder:text-foreground-subtle",
              "focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-foreground-subtle hover:text-foreground transition-colors">
              <X size={12} />
              Clear
            </button>
          )}
          <button
            onClick={openSheet}
            className={cn(
              "flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-[--radius] border transition-colors",
              activeCount > 0
                ? "bg-brand/15 border-brand/40 text-brand"
                : "bg-surface border-border text-foreground-muted hover:border-brand/40 hover:text-foreground"
            )}
          >
            <SlidersHorizontal size={12} />
            Filter
            {activeCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-brand text-white text-[10px] flex items-center justify-center leading-none">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active filter pills */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {location && (
            <span className="flex items-center gap-1 h-6 px-2.5 text-xs rounded-full bg-surface border border-border text-foreground-muted">
              <MapPin size={10} />{location}
              <button onClick={() => { setLocation(""); const p = new URLSearchParams(searchParams.toString()); p.delete("loc"); startTransition(() => router.replace(`${pathname}?${p}`, { scroll: false })); }} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
            </span>
          )}
          {categorySlug && (
            <span className="flex items-center gap-1 h-6 px-2.5 text-xs rounded-full bg-surface border border-border text-foreground-muted">
              {categories.find((c) => c.slug === categorySlug)?.emoji} {categories.find((c) => c.slug === categorySlug)?.label}
              <button onClick={() => { setCategorySlug(""); const p = new URLSearchParams(searchParams.toString()); p.delete("cat"); startTransition(() => router.replace(`${pathname}?${p}`, { scroll: false })); }} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <Card>
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-foreground-muted text-sm">
            No debaters match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-foreground-subtle uppercase tracking-wider w-12">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-subtle uppercase tracking-wider">Debater</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-foreground-subtle uppercase tracking-wider">ELO</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-foreground-subtle uppercase tracking-wider hidden sm:table-cell">W</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-foreground-subtle uppercase tracking-wider hidden sm:table-cell">L</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-foreground-subtle uppercase tracking-wider hidden md:table-cell">Win%</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player, index) => {
                  const rank = index + 1;
                  const total = player.wins + player.losses;
                  const winRate = total > 0 ? Math.round((player.wins / total) * 100) : 0;
                  return (
                    <tr
                      key={player.id}
                      className="border-b border-border-subtle hover:bg-surface-raised transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className={`font-bold text-base ${RANK_COLORS[rank] ?? "text-foreground-muted"}`}>
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/users/${player.username}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          <Avatar initial={player.username[0].toUpperCase()} size="sm" />
                          <div>
                            <span className="font-medium text-foreground">{player.username}</span>
                            {player.country && (
                              <p className="text-xs text-foreground-subtle flex items-center gap-0.5">
                                <MapPin size={10} /> {player.country}
                              </p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="brand" size="sm">{player.elo}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-success hidden sm:table-cell">{player.wins}</td>
                      <td className="px-4 py-3 text-right text-danger hidden sm:table-cell">{player.losses}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className={winRate >= 75 ? "text-success" : winRate >= 60 ? "text-foreground" : "text-foreground-muted"}>
                          {winRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>

    {/* Full-screen filter sheet */}
    {sheetOpen && (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">Filter</h2>
          <button onClick={() => setSheetOpen(false)} className="p-1.5 rounded-full hover:bg-surface-overlay transition-colors">
            <X size={18} className="text-foreground-muted" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
          {/* Location */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2.5">Location</p>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle pointer-events-none" />
              <input
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                placeholder="Country or region..."
                className="w-full h-10 pl-8 pr-3 rounded-[--radius] bg-surface border border-border text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-brand"
              />
            </div>
          </div>
          {/* Category */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2.5">Category</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDraftCategory("")}
                className={cn("py-2.5 px-3 text-sm font-medium rounded-[--radius] border text-left transition-colors",
                  draftCategory === "" ? "bg-brand/15 border-brand text-brand" : "bg-surface border-border text-foreground-muted hover:border-brand/40")}
              >
                {draftCategory === "" && <Check size={12} className="inline mr-1" />}All categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDraftCategory(c.slug)}
                  className={cn("py-2.5 px-3 text-sm font-medium rounded-[--radius] border text-left transition-colors",
                    draftCategory === c.slug ? "bg-brand/15 border-brand text-brand" : "bg-surface border-border text-foreground-muted hover:border-brand/40")}
                >
                  {draftCategory === c.slug && <Check size={12} className="inline mr-1" />}{c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 px-4 py-4 border-t border-border flex gap-3">
          <button
            onClick={clearFilters}
            className="flex-1 py-2.5 text-sm font-medium rounded-[--radius] border border-border text-foreground-muted hover:text-foreground transition-colors"
          >
            Clear all
          </button>
          <button
            onClick={applyFilters}
            className="flex-[2] py-2.5 text-sm font-semibold rounded-[--radius] bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            Apply filters
          </button>
        </div>
      </div>
    )}
    </>
  );
}
