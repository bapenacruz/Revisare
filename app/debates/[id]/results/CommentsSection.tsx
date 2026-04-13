"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Bell, BellOff, MessageSquare, Send, Trash2 } from "lucide-react";

interface Comment {
  id: string;
  userId: string | null;
  username: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
  isLive: boolean;
}

export function CommentsSection({ challengeId }: { challengeId: string }) {
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

  // Fetch subscription status on mount
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

  // Scroll on new comments (not initial load)
  useEffect(() => {
    const count = comments.length;
    if (prevCountRef.current === -1) { prevCountRef.current = count; return; }
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
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-foreground-muted" />
        <h2 className="text-lg font-bold text-foreground">Comments</h2>
        <span className="text-sm text-foreground-muted">({comments.length})</span>
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

      {comments.length === 0 ? (
        <p className="text-sm text-foreground-muted mb-4">No comments yet.</p>
      ) : (
        <div className="flex flex-col gap-4 mb-6">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 group">
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
        <form onSubmit={postComment} className="flex flex-col gap-2">
          <textarea
            className="w-full p-3 rounded-[--radius] bg-surface-raised border border-border text-foreground placeholder:text-foreground-subtle text-sm resize-none focus:outline-none focus:border-brand transition-colors"
            rows={3}
            placeholder="Share your thoughts on the debate..."
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
            disabled={posting}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-muted">{draft.length}/1000</span>
            <Button type="submit" size="sm" disabled={posting || draft.trim().length < 2}>
              <Send size={13} className="mr-1.5" />
              Post Comment
            </Button>
          </div>
          {error && <p className="text-danger text-xs">{error}</p>}
        </form>
      ) : (
        <Card>
          <CardBody className="text-center py-4">
            <p className="text-foreground-muted text-sm mb-2">Sign in to leave a comment.</p>
            <Link href="/auth/login">
              <Button size="sm" variant="outline">Sign In</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
