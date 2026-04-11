"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import {
  Trophy, Trash2, Clock, Swords, History,
  SlidersHorizontal, X, Check,
} from "lucide-react";

interface OpenChallenge {
  id: string;
  type: string;
  status: string;
  motion: string;
  format: string;
  ranked: boolean;
  expiresAt: string | null;
  createdAt: string;
  category: { id: string; label: string; emoji: string; slug: string };
  creator: { id: string; username: string };
  target: { id: string; username: string } | null;
}

interface DebateItem {
  id: string;
  challengeId: string;
  motion: string;
  ranked: boolean;
  winnerId: string | null;
  completedAt: string | null;
  debaterA: { id: string; username: string };
  debaterB: { id: string; username: string };
  category: { id: string; label: string; emoji: string; slug: string };
}

interface Category {
  id: string;
  label: string;
  emoji: string;
  slug: string;
}

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h left`;
  return `${m}m left`;
}

const TABS = [
  { id: "open", label: "Open Debates" },
  { id: "past", label: "Past Debates" },
] as const;

export default function MyDebatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const [openChallenge, setOpenChallenge] = useState<OpenChallenge | null>(null);
  const [history, setHistory] = useState<DebateItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Filters (applied)
  const [filterResult, setFilterResult] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Filter sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftResult, setDraftResult] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  const activeCount = [filterResult, filterCategory, filterRole, filterFrom, filterTo].filter(Boolean).length;
  const userId = session?.user?.id ?? "";

  function openSheet() {
    setDraftResult(filterResult);
    setDraftCategory(filterCategory);
    setDraftRole(filterRole);
    setDraftFrom(filterFrom);
    setDraftTo(filterTo);
    setSheetOpen(true);
  }

  function applyFilters() {
    setFilterResult(draftResult);
    setFilterCategory(draftCategory);
    setFilterRole(draftRole);
    setFilterFrom(draftFrom);
    setFilterTo(draftTo);
    setSheetOpen(false);
  }

  function clearFilters() {
    setFilterResult(""); setFilterCategory(""); setFilterRole(""); setFilterFrom(""); setFilterTo("");
    setDraftResult(""); setDraftCategory(""); setDraftRole(""); setDraftFrom(""); setDraftTo("");
    setSheetOpen(false);
  }

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterResult) params.set("result", filterResult);
    if (filterCategory) params.set("category", filterCategory);
    if (filterRole) params.set("role", filterRole);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    const res = await fetch(`/api/my-debates?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setOpenChallenge(data.openChallenge ?? null);
    setHistory(data.history ?? []);
  }, [filterResult, filterCategory, filterRole, filterFrom, filterTo]);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/auth/login"); return; }
    if (status !== "authenticated") return;
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
    setLoading(false);
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    load();
  }, [status, load]);

  const handleDelete = async () => {
    if (!openChallenge) return;
    setDeleting(true);
    await fetch(`/api/challenges/${openChallenge.id}`, { method: "DELETE" });
    setOpenChallenge(null);
    setConfirmDelete(false);
    setDeleting(false);
  };

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

  if (loading) return null;

  return (
    <>
      {/* ── Tab bar ── */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-3xl flex">
          {TABS.map((tab, i) => {
            const active = activeTab === i;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "relative flex-1 flex items-center justify-center h-12 text-sm font-medium transition-colors duration-150",
                  active ? "text-foreground" : "text-foreground-subtle hover:text-foreground-muted"
                )}
              >
                {tab.label}
                {/* filter badge on Past tab */}
                {i === 1 && activeCount > 0 && (
                  <span className="ml-1.5 w-4 h-4 rounded-full bg-brand text-white text-[10px] flex items-center justify-center leading-none">
                    {activeCount}
                  </span>
                )}
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

      {/* ── Swipeable panels ── */}
      <div
        className="overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: `translateX(calc(-${activeTab} * 100%))` }}
        >
          {/* Panel 0 — Open Debates */}
          <div className="w-full shrink-0 h-[calc(100dvh-11rem)] overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-5 pb-8">
              {!openChallenge ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Swords size={32} className="opacity-20 text-foreground-muted" />
                  <p className="text-sm text-foreground-muted">You have no open debate right now.</p>
                  <Link href="/challenges/new">
                    <Button size="sm">Create a Debate</Button>
                  </Link>
                </div>
              ) : (
                <Card>
                  <CardBody className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default" size="sm">{openChallenge.category.emoji} {openChallenge.category.label}</Badge>
                      {openChallenge.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                      <Badge variant="warning" size="sm" className="capitalize">{openChallenge.status}</Badge>
                      <Badge variant="default" size="sm" className="capitalize">{openChallenge.format}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug">{openChallenge.motion}</p>
                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                      <Avatar initial={openChallenge.creator.username[0].toUpperCase()} size="xs" />
                      <span>{openChallenge.creator.username}</span>
                      <span className="text-foreground-subtle mx-1">VS</span>
                      {openChallenge.target ? (
                        <>
                          <Avatar initial={openChallenge.target.username[0].toUpperCase()} size="xs" />
                          <span>{openChallenge.target.username}</span>
                        </>
                      ) : (
                        <span className="italic text-foreground-subtle">Open slot</span>
                      )}
                    </div>
                    {openChallenge.expiresAt && (
                      <div className="flex items-center gap-1 text-xs text-foreground-subtle">
                        <Clock size={10} />
                        {timeLeft(openChallenge.expiresAt)}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-border mt-1">
                      <Link href={`/challenges/${openChallenge.id}/lobby`}>
                        <Button size="sm" variant="secondary">View Lobby</Button>
                      </Link>
                      {!confirmDelete ? (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="flex items-center gap-1.5 text-xs text-danger hover:text-danger/80 transition-colors"
                        >
                          <Trash2 size={13} />
                          Close debate
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-foreground-muted">Are you sure?</span>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                          <Button
                            size="sm"
                            className="bg-danger hover:bg-danger/80 text-white border-danger"
                            isLoading={deleting}
                            onClick={handleDelete}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          </div>

          {/* Panel 1 — Past Debates */}
          <div className="w-full shrink-0 h-[calc(100dvh-11rem)] overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-5 pb-8">
              {/* Filter bar */}
              <div className="flex items-center justify-end gap-2 mb-3">
                {activeCount > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-foreground-subtle hover:text-foreground transition-colors">
                    <X size={12} />
                    Clear
                  </button>
                )}
                <button
                  onClick={openSheet}
                  className={cn(
                    "flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-full border transition-colors",
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

              {/* Active filter pills */}
              {activeCount > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {filterResult && (
                    <span className="flex items-center gap-1 h-6 px-2.5 text-xs rounded-full bg-surface border border-border text-foreground-muted">
                      {filterResult === "win" ? "Wins" : "Losses"}
                      <button onClick={() => setFilterResult("")} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
                    </span>
                  )}
                  {filterCategory && (
                    <span className="flex items-center gap-1 h-6 px-2.5 text-xs rounded-full bg-surface border border-border text-foreground-muted">
                      {categories.find((c) => c.id === filterCategory)?.emoji} {categories.find((c) => c.id === filterCategory)?.label}
                      <button onClick={() => setFilterCategory("")} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
                    </span>
                  )}
                  {filterRole && (
                    <span className="flex items-center gap-1 h-6 px-2.5 text-xs rounded-full bg-surface border border-border text-foreground-muted capitalize">
                      {filterRole}
                      <button onClick={() => setFilterRole("")} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
                    </span>
                  )}
                  {(filterFrom || filterTo) && (
                    <span className="flex items-center gap-1 h-6 px-2.5 text-xs rounded-full bg-surface border border-border text-foreground-muted">
                      {filterFrom || "…"} → {filterTo || "…"}
                      <button onClick={() => { setFilterFrom(""); setFilterTo(""); }} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
                    </span>
                  )}
                </div>
              )}

              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                  <History size={32} className="opacity-20 text-foreground-muted" />
                  <p className="text-sm text-foreground-muted">No completed debates yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {history.map((debate) => {
                    const isWinner = debate.winnerId === userId;
                    const isLoss = debate.winnerId !== null && debate.winnerId !== userId;
                    return (
                      <Link key={debate.id} href={`/debates/${debate.challengeId}`}>
                        <Card interactive>
                          <CardBody className="flex flex-col gap-2 p-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="default" size="sm">{debate.category.emoji} {debate.category.label}</Badge>
                              {debate.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                              {isWinner && <Badge variant="success" size="sm">Won</Badge>}
                              {isLoss && <Badge variant="danger" size="sm">Lost</Badge>}
                              {debate.winnerId === null && <Badge variant="default" size="sm">No result</Badge>}
                            </div>
                            <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{debate.motion}</p>
                            <div className="flex flex-col gap-1">
                              {[debate.debaterA, debate.debaterB].map((p) => {
                                const won = debate.winnerId === p.id;
                                return (
                                  <div key={p.id} className={cn("flex items-center gap-1.5 text-xs", won ? "font-semibold text-foreground" : "text-foreground-muted opacity-70")}>
                                    {won && <Trophy size={11} className="text-accent shrink-0" />}
                                    {!won && <span className="w-[11px] shrink-0" />}
                                    <Avatar initial={p.username[0].toUpperCase()} size="xs" />
                                    <span className="truncate">{p.username}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {debate.completedAt && (
                              <p className="text-xs text-foreground-subtle">
                                {new Date(debate.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            )}
                          </CardBody>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen filter sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold text-foreground">Filter History</h2>
            <button onClick={() => setSheetOpen(false)} className="p-1.5 rounded-full hover:bg-surface-overlay transition-colors">
              <X size={18} className="text-foreground-muted" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2.5">Result</p>
              <div className="flex gap-2">
                {([["", "All"], ["win", "Wins"], ["loss", "Losses"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setDraftResult(val)}
                    className={cn("flex-1 py-2 text-sm font-medium rounded-[--radius] border transition-colors",
                      draftResult === val ? "bg-brand/15 border-brand text-brand" : "bg-surface border-border text-foreground-muted hover:border-brand/40")}>
                    {draftResult === val && <Check size={12} className="inline mr-1" />}{label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2.5">My Role</p>
              <div className="flex gap-2">
                {([["", "All"], ["creator", "Creator"], ["participant", "Participant"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setDraftRole(val)}
                    className={cn("flex-1 py-2 text-sm font-medium rounded-[--radius] border transition-colors",
                      draftRole === val ? "bg-brand/15 border-brand text-brand" : "bg-surface border-border text-foreground-muted hover:border-brand/40")}>
                    {draftRole === val && <Check size={12} className="inline mr-1" />}{label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2.5">Category</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDraftCategory("")}
                  className={cn("py-2.5 px-3 text-sm font-medium rounded-[--radius] border text-left transition-colors",
                    draftCategory === "" ? "bg-brand/15 border-brand text-brand" : "bg-surface border-border text-foreground-muted hover:border-brand/40")}>
                  {draftCategory === "" && <Check size={12} className="inline mr-1" />}All categories
                </button>
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setDraftCategory(c.id)}
                    className={cn("py-2.5 px-3 text-sm font-medium rounded-[--radius] border text-left transition-colors",
                      draftCategory === c.id ? "bg-brand/15 border-brand text-brand" : "bg-surface border-border text-foreground-muted hover:border-brand/40")}>
                    {draftCategory === c.id && <Check size={12} className="inline mr-1" />}{c.emoji} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2.5">Date Range</p>
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs text-foreground-subtle">From</label>
                  <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)}
                    className="h-10 px-3 text-sm rounded-[--radius] bg-surface border border-border text-foreground focus:outline-none focus:border-brand w-full" />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs text-foreground-subtle">To</label>
                  <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)}
                    className="h-10 px-3 text-sm rounded-[--radius] bg-surface border border-border text-foreground focus:outline-none focus:border-brand w-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 px-4 py-4 border-t border-border flex gap-3">
            <button onClick={clearFilters}
              className="flex-1 py-2.5 text-sm font-medium rounded-[--radius] border border-border text-foreground-muted hover:text-foreground transition-colors">
              Clear all
            </button>
            <button onClick={applyFilters}
              className="flex-[2] py-2.5 text-sm font-semibold rounded-[--radius] bg-brand text-white hover:bg-brand/90 transition-colors">
              Apply filters
            </button>
          </div>
        </div>
      )}
    </>
  );
}
