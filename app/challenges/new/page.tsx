"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { motionTip } from "@/lib/topic-validator";
import {
  Sword, Lock, Globe, Copy, Check, Search, ChevronDown, Wand2, Loader2,
  Bot, FlaskConical,
} from "lucide-react";
import Link from "next/link";

interface Category {
  id: string;
  slug: string;
  label: string;
  emoji: string;
}

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
        on ? "bg-brand" : "bg-surface-overlay"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function NewChallengeForm() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category");
  const router = useRouter();

  const [practice, setPractice] = useState(false);
  // Normal: "open" | "direct" — Practice: "ai" | "direct"
  const [type, setType] = useState<"open" | "direct" | "ai">("open");
  const [categories, setCategories] = useState<Category[]>([]);
  const [motion, setMotion] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [targetUsername, setTargetUsername] = useState("");
  const [following, setFollowing] = useState<{ id: string; username: string; avatarUrl: string | null }[]>([]);
  const [followingSearch, setFollowingSearch] = useState("");
  const [showFollowingPicker, setShowFollowingPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [openDebateBlock, setOpenDebateBlock] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [aiDebate, setAiDebate] = useState(false);
  const [copied, setCopied] = useState(false);
  const originRef = useRef("");
  const [polishing, setPolishing] = useState(false);
  const [categoryChangedMsg, setCategoryChangedMsg] = useState<string | null>(null);

  useEffect(() => {
    originRef.current = window.location.origin;
  }, []);

  // Reset type when switching modes
  useEffect(() => {
    setType(practice ? "ai" : "open");
    setTargetUsername("");
  }, [practice]);

  useEffect(() => {
    if (type === "direct" && session) {
      fetch("/api/me/following")
        .then((r) => r.ok ? r.json() : [])
        .then(setFollowing)
        .catch(() => {});
    }
  }, [type, session]);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowFollowingPicker(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((cats: Category[]) => {
        setCategories(cats);
        if (categorySlug) {
          const match = cats.find((c) => c.slug === categorySlug);
          if (match) setCategoryId(match.id);
        }
      })
      .catch(() => {});
  }, [categorySlug]);

  const tip = motionTip(motion);

  if (status === "loading") return null;

  // ── AI debate: redirect straight to arena ────────────────────────────────
  if (createdId && aiDebate) {
    // Redirect immediately to the debate arena
    router.push(`/debates/${createdId}`);
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Loader2 size={28} className="animate-spin text-brand mx-auto mb-4" />
        <p className="text-foreground-muted">Starting your practice debate…</p>
      </div>
    );
  }

  // ── Normal challenge created ─────────────────────────────────────────────
  if (createdId && !aiDebate) {
    const lobbyUrl = `${originRef.current}/challenges/${createdId}/lobby`;
    function copyLink() {
      navigator.clipboard.writeText(lobbyUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <Check size={28} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Challenge Created!</h1>
        <p className="text-foreground-muted mb-6">Share this link with your opponent or wait in the lobby for someone to accept.</p>
        <div className="flex items-center gap-2 mb-6 p-3 rounded-[--radius] bg-surface border border-border">
          <span className="flex-1 text-sm text-foreground truncate text-left">{lobbyUrl}</span>
          <button
            onClick={copyLink}
            className="shrink-0 p-1.5 rounded-md hover:bg-brand/10 transition-colors"
            aria-label="Copy link"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-foreground-muted" />}
          </button>
        </div>
        <Link href={`/challenges/${createdId}/lobby`}>
          <Button className="w-full">Go to Lobby</Button>
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-foreground-muted mb-4">You need to be signed in to create a challenge.</p>
        <Link href="/auth/login"><Button>Sign In</Button></Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOpenDebateBlock(false);

    if (!categoryId) { setError("Please select a category."); return; }
    if (type === "direct" && !targetUsername) { setError("Please select an opponent."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          motion,
          categoryId,
          format: "standard",
          ranked: !practice,
          isPublic: !practice,
          isPractice: practice,
          targetUsername: type === "direct" ? targetUsername : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "OPEN_DEBATE_EXISTS") { setOpenDebateBlock(true); return; }
        setError(json.error ?? "Something went wrong.");
        return;
      }
      setAiDebate(!!json.aiDebate);
      setCreatedId(json.id);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Type options based on mode ────────────────────────────────────────────
  const typeOptions = practice
    ? ([
        {
          value: "ai" as const,
          icon: <Bot size={15} className="text-brand" />,
          label: "vs AI",
          desc: "Practice against Gemini AI — no ELO impact",
        },
        {
          value: "direct" as const,
          icon: <Lock size={15} className="text-brand" />,
          label: "Direct",
          desc: "Private unranked match with a specific opponent",
        },
      ] as const)
    : ([
        {
          value: "open" as const,
          icon: <Globe size={15} className="text-brand" />,
          label: "Open",
          desc: "Anyone can accept — expires in 15 min",
        },
        {
          value: "direct" as const,
          icon: <Lock size={15} className="text-brand" />,
          label: "Direct",
          desc: "Sent to a specific opponent — expires in 24h",
        },
      ] as const);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[--radius] bg-brand/15 flex items-center justify-center">
              <Sword size={18} className="text-brand" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">New Challenge</h1>
          </div>
          {/* Practice Mode Toggle */}
          <button
            type="button"
            onClick={() => setPractice((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
              practice
                ? "border-brand/60 bg-brand/10 text-brand"
                : "border-border bg-surface text-foreground-muted hover:border-brand/40 hover:text-foreground"
            }`}
          >
            <FlaskConical size={14} />
            Practice Mode
            <Toggle on={practice} onToggle={() => setPractice((v) => !v)} />
          </button>
        </div>
        <p className="text-foreground-muted text-sm">
          {practice
            ? "Practice debates are private and unranked — no ELO impact."
            : "Ranked debates are public and affect your ELO rating."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Challenge type */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Challenge Type</p>
          <div className="grid grid-cols-2 gap-3">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`flex flex-col gap-1.5 p-4 rounded-[--radius] border text-left transition-all ${
                  type === opt.value
                    ? "border-brand bg-brand-dim"
                    : "border-border bg-surface hover:border-brand/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  {opt.icon}
                  <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                </div>
                <span className="text-xs text-foreground-muted">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Direct: target user */}
        {type === "direct" && (
          <div ref={pickerRef}>
            <p className="text-sm font-medium text-foreground mb-2">Opponent</p>
            {following.length === 0 ? (
              <p className="text-sm text-foreground-muted">You are not following anyone yet. Follow users to invite them.</p>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFollowingPicker((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[--radius] border border-border bg-surface text-sm text-left hover:border-brand/40 transition-colors"
                >
                  {targetUsername ? (
                    <span className="flex items-center gap-2 text-foreground">
                      <Avatar
                        initial={targetUsername[0]?.toUpperCase()}
                        src={following.find((f) => f.username === targetUsername)?.avatarUrl ?? undefined}
                        size="sm"
                      />
                      {targetUsername}
                    </span>
                  ) : (
                    <span className="text-foreground-subtle">Select opponent...</span>
                  )}
                  <ChevronDown size={14} className="text-foreground-muted shrink-0" />
                </button>

                {showFollowingPicker && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-[--radius] border border-border bg-surface shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-raised">
                        <Search size={13} className="text-foreground-muted shrink-0" />
                        <input
                          autoFocus
                          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none"
                          placeholder="Search..."
                          value={followingSearch}
                          onChange={(e) => setFollowingSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {following
                        .filter((f) => f.username.toLowerCase().includes(followingSearch.toLowerCase()))
                        .map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setTargetUsername(f.username);
                              setShowFollowingPicker(false);
                              setFollowingSearch("");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-raised transition-colors ${
                              targetUsername === f.username ? "bg-brand-dim text-brand" : "text-foreground"
                            }`}
                          >
                            <Avatar
                              initial={f.username[0]?.toUpperCase()}
                              src={f.avatarUrl ?? undefined}
                              size="sm"
                            />
                            {f.username}
                          </button>
                        ))}
                      {following.filter((f) => f.username.toLowerCase().includes(followingSearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-foreground-muted text-center py-4">No matches.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Category */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Category</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-[--radius] border text-sm transition-all ${
                  categoryId === c.id
                    ? "border-brand bg-brand-dim text-brand"
                    : "border-border bg-surface text-foreground-muted hover:border-brand/40 hover:text-foreground"
                }`}
              >
                <span>{c.emoji}</span>
                <span className="font-medium truncate">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Motion */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-foreground">Motion / Topic</label>
            <button
              type="button"
              disabled={polishing || !motion.trim()}
              onClick={async () => {
                if (!motion.trim()) return;
                setCategoryChangedMsg(null);
                setPolishing(true);
                try {
                  const res = await fetch("/api/challenges/refine-motion", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ motion, categoryId }),
                  });
                  const json = await res.json();
                  if (!res.ok) { setError(json.error ?? "AI polish failed. Please try again."); return; }
                  setMotion(json.motion);
                  if (json.categoryId) setCategoryId(json.categoryId);
                  if (json.categoryChanged && json.categoryLabel) {
                    setCategoryChangedMsg(`Category updated to "${json.categoryLabel}" — a better fit for this motion.`);
                  }
                } catch {
                  setError("Network error. Please try again.");
                } finally {
                  setPolishing(false);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[--radius] text-xs font-medium border border-brand/40 text-brand bg-brand/5 hover:bg-brand/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {polishing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {polishing ? "Polishing…" : "Polish with AI"}
            </button>
          </div>
          <textarea
            value={motion}
            onChange={(e) => { setMotion(e.target.value); setCategoryChangedMsg(null); }}
            placeholder="Describe what you want to debate, or write your motion directly…"
            rows={3}
            maxLength={280}
            required
            className="w-full rounded-[--radius] bg-surface border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-subtle resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
          />
          <div className="flex items-start justify-between gap-2">
            {categoryChangedMsg ? (
              <p className="text-xs text-brand flex items-center gap-1"><Wand2 size={11} />{categoryChangedMsg}</p>
            ) : tip ? (
              <p className="text-xs text-foreground-subtle">{tip}</p>
            ) : <span />}
            <span className="text-xs text-foreground-subtle shrink-0">{motion.length}/280</span>
          </div>
        </div>

        {/* Mode summary badges */}
        <div className="flex flex-wrap gap-2">
          {practice ? (
            <>
              <Badge variant="default" size="sm">Unranked</Badge>
              <Badge variant="default" size="sm">Private</Badge>
              <Badge variant="info" size="sm">Practice</Badge>
            </>
          ) : (
            <>
              <Badge variant="accent" size="sm">Ranked</Badge>
              <Badge variant="info" size="sm">Public</Badge>
            </>
          )}
          <Badge variant="default" size="sm">Standard</Badge>
          <Badge variant="default" size="sm">~15 min</Badge>
        </div>

        {openDebateBlock && (
          <div className="flex flex-col gap-2 bg-warning/10 border border-warning/30 rounded-[--radius] px-4 py-3">
            <p className="text-sm font-medium text-foreground">You already have an open debate.</p>
            <p className="text-xs text-foreground-muted">Close your existing debate before creating a new one.</p>
            <Link href="/challenges" className="text-xs text-brand underline underline-offset-2 w-fit">Go to My Debates →</Link>
          </div>
        )}

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-[--radius] px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/debates">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
          <Button type="submit" isLoading={submitting} disabled={submitting}>
            {type === "ai" ? <Bot size={15} /> : <Sword size={15} />}
            {type === "ai"
              ? "Start Practice vs AI"
              : type === "open"
              ? "Post Open Challenge"
              : "Send Direct Challenge"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewChallengePage() {
  return (
    <Suspense>
      <NewChallengeForm />
    </Suspense>
  );
}
