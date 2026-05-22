"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody } from "@/components/ui/Card";
import { CheckCircle, Clock, Lock, Sword, AlertTriangle, LogOut, UserPlus, X } from "lucide-react";
import Link from "next/link";

interface Participant {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface JoinRequester {
  id: string;
  username: string;
  avatarUrl: string | null;
  elo: number;
  wins: number;
  losses: number;
  country: string | null;
}

interface JoinRequest {
  id: string;
  userId: string;
  user: JoinRequester;
}

interface Challenge {
  id: string;
  type: string;
  status: string;
  motion: string;
  format: string;
  ranked: boolean;
  isPublic: boolean;
  timerPreset: number;
  creatorId: string;
  targetId: string | null;
  creatorAccepted: boolean;
  targetAccepted: boolean;
  lockedAt: string | null;
  expiresAt: string | null;
  category: { id: string; label: string; emoji: string; slug: string };
  creator: Participant;
  target: Participant | null;
  joinRequests: JoinRequest[];
}

interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

const FORMAT_LABEL: Record<string, string> = {
  quick: "Quick",
  standard: "Standard",
};

const TERMS = [
  "I will argue in good faith and not submit off-topic responses.",
  "I understand this debate may be reviewed by AI judges and platform moderators.",
  "I will not use AI tools to generate my debate responses.",
  "I accept the format, timer, and rules set out for this challenge.",
  "I agree to be respectful, even in strong disagreement.",
];

export default function LobbyPage() {
  const { id: challengeId } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<JoinRequest | null>(null);
  const [approving, setApproving] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchChallenge = useCallback(async () => {
    const res = await fetch(`/api/challenges/${challengeId}`);
    if (res.status === 404) { setNotFound(true); return; }
    if (!res.ok) return;
    const data: Challenge = await res.json();
    setChallenge(data);
    if (data.status === "active") {
      router.push(`/debates/${data.id}`);
    }
    // Surface a pending join request to the creator
    if (data.joinRequests && data.joinRequests.length > 0) {
      const req = data.joinRequests[0];
      setPendingRequest((prev) => (prev?.id === req.id ? prev : req));
    }
  }, [challengeId, router]);

  const fetchMessages = useCallback(async () => {
    // chat removed
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchChallenge();
    // Poll every 3s (Pusher replaces this in Step 4)
    pollRef.current = setInterval(() => {
      fetchChallenge();
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, fetchChallenge, fetchMessages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    // chat removed
  }

  async function leaveDebate() {
    if (!confirm("Are you sure you want to leave this lobby?")) return;
    setLeaving(true);
    setError("");
    try {
      const res = await fetch(`/api/challenges/${challengeId}/leave`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to leave."); return; }
      router.push("/");
    } catch {
      setError("Network error.");
    } finally {
      setLeaving(false);
    }
  }

  async function approveRequest(requestId: string) {
    setApproving(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    try {
      await fetch(`/api/challenges/${challengeId}/join/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      setPendingRequest(null);
      await fetchChallenge();
    } finally {
      setApproving(false);
    }
  }

  async function rejectRequest(requestId: string) {
    if (countdownRef.current) clearInterval(countdownRef.current);
    await fetch(`/api/challenges/${challengeId}/join/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    setPendingRequest(null);
    await fetchChallenge();
  }

  // Countdown + auto-approve when a join request appears
  useEffect(() => {
    if (!pendingRequest) {
      setCountdown(15);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    setCountdown(15);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          approveRequest(pendingRequest.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest?.id]);

  async function joinChallenge() {
    setJoining(true);
    setError("");
    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to join."); return; }
      setHasRequested(true);
      await fetchChallenge();
    } catch {
      setError("Network error.");
    } finally {
      setJoining(false);
    }
  }

  async function acceptTerms() {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(`/api/challenges/${challengeId}/accept`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to accept."); return; }
      await fetchChallenge();
    } catch {
      setError("Network error.");
    } finally {
      setAccepting(false);
    }
  }

  if (status === "loading" || (!challenge && !notFound)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-foreground-muted mb-4">Challenge not found or you&apos;re not a participant.</p>
        <Link href="/debates"><Button variant="secondary">Browse Debates</Button></Link>
      </div>
    );
  }

  if (!challenge) return null;

  const userId = session?.user?.id ?? "";
  const isCreator = challenge.creatorId === userId;
  const isTarget = challenge.targetId === userId;
  const isParticipant = isCreator || isTarget;
  const isLocked = challenge.status === "locked" || challenge.status === "active";

  const myAccepted = isCreator ? challenge.creatorAccepted : challenge.targetAccepted;
  const otherAccepted = isCreator ? challenge.targetAccepted : challenge.creatorAccepted;
  const otherUser = isCreator ? challenge.target : challenge.creator;

  const expiresAt = challenge.expiresAt ? new Date(challenge.expiresAt) : null;
  const minutesLeft = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000))
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">

      {/* Join request popup — only visible to the creator */}
      {isCreator && pendingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[--radius] bg-surface border border-border shadow-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-brand" />
                <p className="text-sm font-semibold text-foreground">Join Request</p>
              </div>
              <button onClick={() => rejectRequest(pendingRequest.id)} className="text-foreground-subtle hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-[--radius-sm] bg-surface-raised border border-border">
              <Avatar initial={pendingRequest.user.username[0].toUpperCase()} src={pendingRequest.user.avatarUrl ?? undefined} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{pendingRequest.user.username}</p>
                <div className="flex items-center gap-3 text-xs text-foreground-subtle mt-0.5">
                  <span>⚡ {pendingRequest.user.elo} ELO</span>
                  <span>✅ {pendingRequest.user.wins}W</span>
                  <span>❌ {pendingRequest.user.losses}L</span>                  {pendingRequest.user.country && <span>📍 {pendingRequest.user.country}</span>}                </div>
              </div>
            </div>
            <p className="text-xs text-foreground-subtle mb-4 text-center">
              Auto-accepting in <span className="font-bold text-brand">{countdown}s</span> if no action taken
            </p>
            {/* Countdown bar */}
            <div className="w-full h-1 rounded-full bg-surface-overlay mb-4 overflow-hidden">
              <div
                className="h-full bg-brand transition-none rounded-full"
                style={{ width: `${(countdown / 15) * 100}%` }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 text-danger border-danger/30 hover:bg-danger/10"
                onClick={() => rejectRequest(pendingRequest.id)}
                disabled={approving}
              >
                Decline
              </Button>
              <Button
                className="flex-1"
                onClick={() => approveRequest(pendingRequest.id)}
                isLoading={approving}
                disabled={approving}
              >
                <CheckCircle size={14} /> Accept
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[--radius] bg-brand/15 flex items-center justify-center shrink-0">
            <Sword size={18} className="text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-base font-semibold text-foreground">Setup Lobby</h1>
              {isLocked ? (
                <Badge variant="success" size="sm"><Lock size={10} /> Locked</Badge>
              ) : (
                <Badge variant="default" size="sm">Waiting</Badge>
              )}
            </div>
            <p className="text-xs text-foreground-muted">
              {challenge.category.emoji} {challenge.category.label} &middot; {FORMAT_LABEL[challenge.format]} &middot;{" "}
              {challenge.ranked ? "Ranked" : "Unranked"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {minutesLeft !== null && !isLocked && (
            <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
              <Clock size={12} />
              Expires in {minutesLeft}m
            </div>
          )}
          {isParticipant && !isLocked && (
            <Button variant="ghost" size="sm" onClick={leaveDebate} isLoading={leaving} disabled={leaving} className="text-danger hover:text-danger">
              <LogOut size={14} />
              Leave
            </Button>
          )}
        </div>
      </div>

      {/* Motion */}
      <div className="mb-6 px-4 py-4 rounded-[--radius] border border-border bg-surface">
        <p className="text-xs font-semibold text-foreground-subtle uppercase tracking-wider mb-1.5">Motion</p>
        <p className="text-foreground font-medium leading-relaxed">{challenge.motion}</p>
      </div>

      <div className="flex flex-col gap-4 max-w-2xl">
        {/* Participants */}
        <Card>
          <CardBody className="flex items-center gap-8 p-4">
              {[challenge.creator, challenge.target].map((u, i) => {
                if (!u) {
                  return (
                    <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                        <span className="text-xs text-foreground-subtle">?</span>
                      </div>
                      <span className="text-xs text-foreground-subtle italic">Waiting for opponent...</span>
                    </div>
                  );
                }
                const accepted = i === 0 ? challenge.creatorAccepted : challenge.targetAccepted;
                return (
                  <div key={u.id} className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="relative">
                      <Avatar initial={u.username[0].toUpperCase()} size="md" />
                      {accepted && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center">
                          <CheckCircle size={10} className="text-white" />
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-foreground">{u.username}</span>
                    <span className={`text-xs ${accepted ? "text-success" : "text-foreground-subtle"}`}>
                      {accepted ? "Terms accepted" : "Pending..."}
                    </span>
                  </div>
                );
              })}
              <div className="text-foreground-subtle font-bold text-sm self-center">VS</div>
          </CardBody>
        </Card>

        {/* Agreed terms panel */}
        <Card>
          <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={14} className="text-brand" />
                <p className="text-sm font-semibold text-foreground">Debate Terms</p>
                <span className="text-xs text-foreground-subtle ml-auto">Must be accepted by both</span>
              </div>
              <ul className="flex flex-col gap-2 mb-4">
                {TERMS.map((term, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground-muted">
                    <span className="w-4 h-4 rounded-full bg-surface-raised border border-border text-foreground-subtle text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {term}
                  </li>
                ))}
              </ul>

              {isLocked ? (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle size={15} />
                  Both participants accepted — debate ready to start!
                </div>
              ) : (
                <>
                  {error && (
                    <div className="flex items-center gap-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-[--radius-sm] px-3 py-2 mb-3">
                      <AlertTriangle size={12} />
                      {error}
                    </div>
                  )}
                  {challenge.type === "open" && !challenge.targetId && !isParticipant ? (
                    hasRequested ? (
                      <div className="flex items-center gap-2 text-sm text-foreground-muted italic">
                        <Clock size={14} />
                        Waiting for the owner to accept you...
                      </div>
                    ) : (
                      <Button onClick={joinChallenge} isLoading={joining} disabled={joining}>
                        <Sword size={14} />
                        Join this Debate
                      </Button>
                    )
                  ) : challenge.type === "open" && !challenge.targetId && isCreator ? (
                    <div className="text-sm text-foreground-muted italic">
                      Waiting for an opponent to accept the open challenge...
                    </div>
                  ) : myAccepted ? (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle size={15} />
                      You&apos;ve accepted. Waiting for {otherUser?.username ?? "opponent"}...
                    </div>
                  ) : (
                    <Button onClick={acceptTerms} isLoading={accepting} disabled={accepting}>
                      <CheckCircle size={14} />
                      I Accept These Terms
                    </Button>
                  )}
                </>
              )}

              {/* Per-person status */}
              {!isLocked && (
                <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`w-2 h-2 rounded-full ${challenge.creatorAccepted ? "bg-success" : "bg-surface-overlay"}`} />
                    <span className="text-foreground-muted">{challenge.creator.username}</span>
                  </div>
                  {challenge.target && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${challenge.targetAccepted ? "bg-success" : "bg-surface-overlay"}`} />
                      <span className="text-foreground-muted">{challenge.target.username}</span>
                    </div>
                  )}
                </div>
              )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
