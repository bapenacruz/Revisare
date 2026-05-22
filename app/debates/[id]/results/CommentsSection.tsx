"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Bell, BellOff, MessageSquare, Send, ThumbsUp, Trash2, Users } from "lucide-react";

interface Comment {
  id: string;
  userId: string | null;
  username: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
  isLive: boolean;
}

interface Debater { id: string; username: string; }

interface Props {
  challengeId: string;
  debateId?: string;
  debaterA?: Debater;
  debaterB?: Debater;
  initialVotes?: Record<string, number>;
  isParticipant?: boolean;
  isAuthenticated?: boolean;
}

export function CommentsSection({ challengeId, debateId, debaterA, debaterB, initialVotes = {}, isParticipant = false, isAuthenticated = false }: Props) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [togglingSubscription, setTogglingSubscription] = useState(false);
  const prevCountRef = useRef(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const hasScrolledToHash = useRef(false);

  // ── Vote state ──────────────────────────────────────────────────────────────
  const [votes, setVotes] = useState<Record<string, number>>(initialVotes);
  const [voted, setVoted] = useState<string | null>(null);
  const [voteLoading, setVoteLoading] = useState(false);

  useEffect(() => {
    if (!debateId) return;
    const stored = localStorage.getItem(`vote-${debateId}`);
    if (stored) setVoted(stored);
  }, [debateId]);

  useEffect(() => { setVotes(initialVotes); }, [initialVotes]);

  useEffect(() => {
    if (!debaterA || !debaterB) return;
    async function fetchTally() {
      try {
        const res = await fetch(`/api/debates/${challengeId}/vote`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (json.tally) setVotes(json.tally as Record<string, number>);
      } catch { /* ignore */ }
    }
    fetchTally();
    const poll = setInterval(fetchTally, 8000);
    return () => clearInterval(poll);
  }, [challengeId, debaterA, debaterB]);

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const pct = (id: string) =>
    totalVotes === 0 ? 0 : Math.round(((votes[id] ?? 0) / totalVotes) * 100);

  async function castVote(userId: string) {
    if (voteLoading) return;
    setVoteLoading(true);
    let voterToken = localStorage.getItem("voter_id");
    if (!voterToken) {
      voterToken = crypto.randomUUID();
      localStorage.setItem("voter_id", voterToken);
    }
    try {
      const res = await fetch(`/api/debates/${challengeId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votedForId: userId, voterToken }),
      });
      const json = await res.json();
      if (json.tally) setVotes(json.tally);
      if (json.removed) {
        setVoted(null);
        localStorage.removeItem(`vote-${debateId}`);
      } else {
        setVoted(userId);
        localStorage.setItem(`vote-${debateId}`, userId);
      }
    } finally {
      setVoteLoading(false);
    }
  }

  // ── Comments ────────────────────────────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/debates/${challengeId}/comments`);
    if (res.ok) {
      const data: Comment[] = await res.json();
      setComments(data);
    }
  }, [challengeId]);

  useEffect(() => {
    fetchComments();
    const poll = setInterval(fetchComments, 10_000);
    return () => clearInterval(poll);
  }, [fetchComments]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/debates/${challengeId}/comment-subscriptions`)
      .then((r) => r.json())
      .then((data) => setSubscribed(!!data.subscribed))
      .catch(() => {});
  }, [challengeId, session?.user?.id]);

  async function toggleSubscription() {
    if (togglingSubscription) return;
    setTogglingSubscription(true);
    try {
      if (subscribed) {
        await fetch(`/api/debates/${challengeId}/comment-subscriptions`, { method: "DELETE" });
        setSubscribed(false);
      } else {
        await fetch(`/api/debates/${challengeId}/comment-subscriptions`, { method: "POST" });
        setSubscribed(true);
      }
    } finally {
      setTogglingSubscription(false);
    }
  }

  useEffect(() => {
    const count = comments.length;
    if (prevCountRef.current === -1) {
      prevCountRef.current = count;
      if (!hasScrolledToHash.current && typeof window !== "undefined") {
        const hash = window.location.hash.slice(1);
        if (hash.startsWith("comment-")) {
          hasScrolledToHash.current = true;
          setTimeout(() => {
            document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      }
      return;
    }
    if (count > prevCountRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = count;
  }, [comments]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || posting) return;
    setError("");
    setPosting(true);
    try {
      const res = await fetch(`/api/debates/${challengeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to post."); return; }
      setDraft("");
      await fetchComments();
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (deletingId) return;
    setDeletingId(commentId);
    try {
      await fetch(`/api/debates/${challengeId}/comments/${commentId}`, { method: "DELETE" });
      await fetchComments();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardBody>
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Users size={15} className="text-foreground-muted" />
          <h2 className="text-base font-bold text-foreground">Community</h2>
          {session?.user?.id && (
            <button
              onClick={toggleSubscription}
              disabled={togglingSubscription}
              title={subscribed ? "Mute notifications for this debate" : "Get notified of new comments"}
              className="ml-auto flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-surface-raised disabled:opacity-50"
            >
              {subscribed ? (
                <><Bell size={13} className="text-brand" /><span className="text-brand">Notifying</span></>
              ) : (
                <><BellOff size={13} /><span>Muted</span></>
              )}
            </button>
          )}
        </div>

        {/* ── Audience Pick Vote (compact) ───────────────────────────── */}
        {debaterA && debaterB && (
          <div className="mb-3 pb-3 border-b border-border flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-foreground-subtle">Who won?</span>
            <div className="flex gap-1 ml-auto">
              {[debaterA, debaterB].map((d) => {
                const p = pct(d.id);
                const isMyVote = voted === d.id;
                const canVote = isAuthenticated && !isParticipant;
                const Tag = canVote ? "button" : "span";
                return (
                  <Tag
                    key={d.id}
                    {...(canVote ? { onClick: () => castVote(d.id), disabled: voteLoading, type: "button" as const } : {})}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] transition-colors ${
                      isMyVote
                        ? "border-brand bg-brand/15 text-brand font-semibold"
                        : canVote
                        ? "border-border bg-surface-raised text-foreground-muted hover:border-brand/40 hover:text-foreground cursor-pointer"
                        : "border-border bg-surface-raised text-foreground-muted"
                    }`}
                  >
                    <span className="truncate max-w-[72px]">{d.username}</span>
                    <span className="opacity-60">{p}%</span>
                    {isMyVote && <span>✓</span>}
                  </Tag>
                );
              })}
            </div>
            {!isAuthenticated && (
              <Link href="/auth/login" className="text-[11px] text-brand hover:underline ml-1">Sign in to vote</Link>
            )}
          </div>
        )}

        {/* ── Comments ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 mb-3">
          <MessageSquare size={13} className="text-foreground-muted" />
          <span className="text-xs font-semibold text-foreground">Comments</span>
          <span className="text-xs text-foreground-muted">({comments.length})</span>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-foreground-muted mb-4">No comments yet.</p>
        ) : (
          <div className="flex flex-col gap-4 mb-4">
            {comments.map((c) => (
              <div key={c.id} id={`comment-${c.id}`} className="flex gap-3 group scroll-mt-20 target:bg-brand-dim/30 rounded-lg -mx-2 px-2 py-1 transition-colors">
                <Avatar initial={c.username[0]} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{c.username}</span>
                    {c.isLive && (
                      <span title="Sent during live debate" className="inline-flex items-center gap-1 text-[10px] font-medium text-danger">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block" />
                        LIVE
                      </span>
                    )}
                    <span className="text-xs text-foreground-muted">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    {session?.user?.id === c.userId && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        disabled={deletingId === c.id}
                        title="Delete comment"
                        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-danger/10 text-foreground-subtle hover:text-danger disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground-muted leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}

        {session ? (
          <form onSubmit={postComment} className="flex gap-2 items-end">
            <textarea
              className="flex-1 p-2.5 rounded-[--radius] bg-surface-raised border border-border text-foreground placeholder:text-foreground-subtle text-sm resize-none focus:outline-none focus:border-brand transition-colors"
              rows={2}
              placeholder="Share your thoughts..."
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              disabled={posting}
            />
            <Button type="submit" size="sm" disabled={posting || draft.trim().length < 2} className="shrink-0">
              <Send size={13} />
            </Button>
          </form>
        ) : (
          <p className="text-xs text-center text-foreground-muted">
            <Link href="/auth/login" className="text-brand hover:underline">Sign in</Link> to comment
          </p>
        )}
        {error && <p className="text-danger text-xs mt-1">{error}</p>}
      </CardBody>
    </Card>
  );
}

