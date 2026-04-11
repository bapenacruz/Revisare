"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { MessageSquare, Send } from "lucide-react";

interface Comment {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
}

export function CommentsSection({ challengeId }: { challengeId: string }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-foreground-muted" />
        <h2 className="text-lg font-bold text-foreground">Comments</h2>
        <span className="text-sm text-foreground-muted">({comments.length})</span>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-foreground-muted mb-4">No comments yet. Share your thoughts!</p>
      ) : (
        <div className="flex flex-col gap-4 mb-6">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar initial={c.username[0]} size="sm" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground">{c.username}</span>
                  <span className="text-xs text-foreground-muted">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
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
            placeholder="Share your thoughts on the debate…"
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
