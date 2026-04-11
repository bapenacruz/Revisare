"use client";

import { useEffect, useState } from "react";
import { ThumbsUp } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";

interface Debater {
  id: string;
  username: string;
}

interface Props {
  challengeId: string;
  debateId: string;
  debaterA: Debater;
  debaterB: Debater;
  /** Server-rendered initial tally: { userId: count } */
  initialVotes: Record<string, number>;
  isParticipant: boolean;
}

export function AudienceVotePanel({ challengeId, debateId, debaterA, debaterB, initialVotes, isParticipant }: Props) {
  const [votes, setVotes] = useState<Record<string, number>>(initialVotes);
  const [voted, setVoted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`vote-${debateId}`);
    if (stored) setVoted(stored);
  }, [debateId]);

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const pct = (id: string) =>
    totalVotes === 0 ? 0 : Math.round(((votes[id] ?? 0) / totalVotes) * 100);

  async function castVote(userId: string) {
    if (loading) return;
    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-1">
          <ThumbsUp size={13} className="text-accent" />
          <span className="text-sm font-semibold text-foreground">Audience Pick</span>
          <span className="text-xs text-foreground-muted ml-auto">{totalVotes} votes</span>
        </div>
        <p className="text-xs text-foreground-muted mb-3">Separate from the official AI judge.</p>

        {isParticipant ? (
          <p className="text-xs text-foreground-muted italic text-center py-2">
            Participants cannot vote in their own debate.
          </p>
        ) : (
          <>
            {[debaterA, debaterB].map((d) => {
              const p = pct(d.id);
              const isMyVote = voted === d.id;
              const isOtherVote = voted !== null && voted !== d.id;
              const isProp = d.id === debaterA.id;
              return (
                <div key={d.id} className="mb-2">
                  <button
                    onClick={() => castVote(d.id)}
                    disabled={loading}
                    title={
                      isMyVote
                        ? "Click again to remove your vote"
                        : isOtherVote
                          ? "Transfer your vote here"
                          : undefined
                    }
                    className={`w-full flex items-center gap-2 p-2 rounded-[--radius] border transition-colors text-left ${
                      isMyVote
                        ? "border-accent bg-accent/10 hover:bg-danger/10 hover:border-danger/40 cursor-pointer"
                        : isOtherVote
                          ? "border-border hover:border-brand/60 hover:bg-brand/5 bg-surface-raised cursor-pointer"
                          : "border-border hover:border-brand/40 bg-surface-raised"
                    }`}
                  >
                    <Avatar initial={d.username[0]} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground truncate">
                          {d.username}
                          {isMyVote && (
                            <span className="ml-1.5 text-[10px] text-accent font-semibold">✓ your vote</span>
                          )}
                        </span>
                        <span className="text-xs text-foreground-muted shrink-0 ml-1">{p}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-surface-overlay overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${p}%`,
                            backgroundColor: isProp ? "var(--brand)" : "var(--danger)",
                          }}
                        />
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
            {!voted && (
              <p className="text-xs text-foreground-muted text-center mt-1">Click to cast your vote</p>
            )}
            {voted && (
              <p className="text-xs text-foreground-muted text-center mt-1">
                Click your pick again to remove · click the other to transfer
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
