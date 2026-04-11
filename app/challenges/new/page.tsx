"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { motionTip } from "@/lib/topic-validator";
import { Sword, Lock, Globe, Trophy, Users, Copy, Check, Search, ChevronDown } from "lucide-react";
import Link from "next/link";

const FORMATS = [
  {
    id: "quick",
    label: "Quick",
    desc: "~10 min total",
    rounds: [
      { round: "Opening", time: "2 min" },
      { round: "Rebuttal", time: "2 min" },
      { round: "Closing", time: "1 min" },
    ],
  },
  {
    id: "standard",
    label: "Standard",
    desc: "~15 min total",
    rounds: [
      { round: "Opening", time: "3 min" },
      { round: "Rebuttal", time: "3 min" },
      { round: "Closing", time: "1.5 min" },
    ],
  },
];

interface Category {
  id: string;
  slug: string;
  label: string;
  emoji: string;
}

function NewChallengeForm() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category");

  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<"open" | "direct">("open");
  const [motion, setMotion] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [format, setFormat] = useState("quick");
  const [ranked, setRanked] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [targetUsername, setTargetUsername] = useState("");
  const [following, setFollowing] = useState<{ id: string; username: string; avatarUrl: string | null }[]>([]);
  const [followingSearch, setFollowingSearch] = useState("");
  const [showFollowingPicker, setShowFollowingPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [openDebateBlock, setOpenDebateBlock] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const originRef = useRef("");

  useEffect(() => {
    originRef.current = window.location.origin;
  }, []);

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

  const tip = motionTip(motion);

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

  // Enforce ranked => public
  useEffect(() => {
    if (ranked) setIsPublic(true);
  }, [ranked]);

  if (status === "loading") return null;

  if (createdId) {
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

    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          motion,
          categoryId,
          format,
          ranked,
          isPublic,
          targetUsername: type === "direct" ? targetUsername : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "OPEN_DEBATE_EXISTS") { setOpenDebateBlock(true); return; }
        setError(json.error ?? "Something went wrong.");
        return;
      }
      setCreatedId(json.id);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-[--radius] bg-brand/15 flex items-center justify-center">
            <Sword size={18} className="text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">New Challenge</h1>
        </div>
        <p className="text-foreground-muted text-sm">
          Set up your debate challenge. Open challenges are visible to everyone; direct challenges go straight to one opponent.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Challenge type */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Challenge Type</p>
          <div className="grid grid-cols-2 gap-3">
            {(["open", "direct"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex flex-col gap-1.5 p-4 rounded-[--radius] border text-left transition-all ${
                  type === t
                    ? "border-brand bg-brand-dim"
                    : "border-border bg-surface hover:border-brand/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  {t === "open" ? <Globe size={15} className="text-brand" /> : <Lock size={15} className="text-brand" />}
                  <span className="text-sm font-semibold text-foreground capitalize">{t}</span>
                </div>
                <span className="text-xs text-foreground-muted">
                  {t === "open"
                    ? "Anyone can accept — expires in 15 min"
                    : "Sent to a specific opponent — expires in 24h"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Direct: target user (from people you follow) */}
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
                    <span className="text-foreground-subtle">Select opponent…</span>
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
                          placeholder="Search…"
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
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-raised transition-colors ${targetUsername === f.username ? "bg-brand-dim text-brand" : "text-foreground"}`}
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
          <label className="text-sm font-medium text-foreground">
            Motion / Topic
          </label>
          <textarea
            value={motion}
            onChange={(e) => setMotion(e.target.value)}
            placeholder='e.g. "This house believes social media does more harm than good."'
            rows={3}
            maxLength={280}
            required
            className="w-full rounded-[--radius] bg-surface border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-subtle resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
          />
          <div className="flex items-start justify-between gap-2">
            {tip ? (
              <p className="text-xs text-foreground-subtle">{tip}</p>
            ) : <span />}
            <span className="text-xs text-foreground-subtle shrink-0">{motion.length}/280</span>
          </div>
        </div>

        {/* Format */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Format</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`flex flex-col gap-2 p-4 rounded-[--radius] border text-left transition-all ${
                  format === f.id
                    ? "border-brand bg-brand-dim"
                    : "border-border bg-surface hover:border-brand/40"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-foreground">{f.label}</span>
                  <span className="text-xs text-foreground-muted">{f.desc}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {f.rounds.map((r) => (
                    <div key={r.round} className="flex items-center justify-between text-xs text-foreground-muted">
                      <span>{r.round}</span>
                      <span className="font-medium text-foreground-subtle">{r.time} / side</span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Timer preset */}
        {/* Removed — timer is fixed per round by format */}

        {/* Ranked / Visibility */}
        <Card>
          <CardBody className="flex flex-col gap-4 p-4">
            {/* Ranked toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Trophy size={16} className="text-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Ranked Match</p>
                  <p className="text-xs text-foreground-muted">Affects ELO. Always public.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRanked((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  ranked ? "bg-brand" : "bg-surface-overlay"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    ranked ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Visibility toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-brand shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Public</p>
                  <p className="text-xs text-foreground-muted">Spectators can watch. Required if ranked.</p>
                </div>
              </div>
              <button
                type="button"
                disabled={ranked}
                onClick={() => !ranked && setIsPublic((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPublic ? "bg-brand" : "bg-surface-overlay"
                } ${ranked ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    isPublic ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </CardBody>
        </Card>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={ranked ? "accent" : "default"} size="sm">
            {ranked ? "Ranked" : "Unranked"}
          </Badge>
          <Badge variant={isPublic ? "info" : "default"} size="sm">
            {isPublic ? "Public" : "Private"}
          </Badge>
          <Badge variant="default" size="sm">
            {FORMATS.find((f) => f.id === format)?.label}
          </Badge>
          <Badge variant="default" size="sm">
            {FORMATS.find((f) => f.id === format)?.desc}
          </Badge>
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
            <Sword size={15} />
            {type === "open" ? "Post Open Challenge" : "Send Direct Challenge"}
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
