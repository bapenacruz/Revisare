"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import Link from "next/link";
import { Send, Clock, CheckCircle, AlertTriangle, Eye, ThumbsUp, Gavel, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody } from "@/components/ui/Card";
import { CoinFlip } from "@/components/debate/CoinFlip";
import { Modal } from "@/components/ui/Modal";
import { CommentsSection } from "./results/CommentsSection";
import { getPusherClient } from "@/lib/pusher-client";
import {
  getTurnSequence,
  formatTimer,
  ROUND_LABEL,
  MIN_CHARS,
  MAX_CHARS,
  type RoundName,
} from "@/lib/debate-state";

// ── Types ────────────────────────────────────────────────────────────────────

interface JudgeResult {
  id: string;
  judgeId: string;
  winnerId: string | null;
  explanation: string | null;
  privateFeedbackA: string | null;
  privateFeedbackB: string | null;
  roundScores: string;
}

interface Participant {
  id: string;
  username: string;
  avatarUrl: string | null;
  elo: number;
}

interface Turn {
  id: string;
  userId: string;
  roundName: string;
  content: string;
  isAutoSubmit: boolean;
  submittedAt: string;
}

interface SpecMsg {
  id: string;
  userId: string | null;
  username: string;
  content: string;
  createdAt: string;
}

interface DebateState {
  id: string;
  challengeId: string;
  motion: string;
  format: string;
  ranked: boolean;
  isPublic: boolean;
  status: string;
  phase: string;
  timerPreset: number;
  timerStartedAt: string | null;
  prepEndsAt: string | null;
  currentTurnIndex: number;
  currentUserId: string | null;
  coinFlipWinnerId: string | null;
  debaterAId: string;
  debaterBId: string;
  winnerId: string | null;
  forfeitedBy: string | null;
  secondChancePending: boolean;
  secondChanceRequesterId: string | null;
  secondChanceExpiresAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  debaterA: Participant;
  debaterB: Participant;
  category: { id: string; label: string; emoji: string; slug: string };
  turns: Turn[];
  spectatorMessages: SpecMsg[];
  audienceVotes: Record<string, number>;
  judgeResults: JudgeResult[];
}

// ── Judge display mapping ────────────────────────────────────────────────────

const JUDGE_DISPLAY: Record<string, { label: string; accent: string }> = {
  "judge-grok": { label: "Grok", accent: "text-emerald-500" },
  "judge-claude": { label: "Claude", accent: "text-violet-500" },
  "judge-arbiter": { label: "ChatGPT", accent: "text-brand" },
  "judge-left": { label: "Left-Leaning", accent: "text-blue-500" },
  "judge-right": { label: "Right-Leaning", accent: "text-red-500" },
  "judge-center": { label: "Centrist", accent: "text-foreground-muted" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function useCountdown(targetMs: number | null): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (targetMs === null) return;
    const tick = () => setLeft(Math.max(0, (targetMs - Date.now()) / 1000));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [targetMs]);
  return left;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ArenaPage() {
  const { id: challengeId } = useParams<{ id: string }>();
  const { data: session, status: authStatus } = useSession();

  const [debate, setDebate] = useState<DebateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Typing turn
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [turnError, setTurnError] = useState("");
  const autoSubmittedRef = useRef(false);

  // Second-chance
  const [scLoading, setScLoading] = useState(false);

  // Forfeit confirmation modal
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);

  // Spectator chat
  const [specDraft, setSpecDraft] = useState("");
  const [guestName, setGuestName] = useState("");
  const [sendingSpec, setSendingSpec] = useState(false);
  const specEndRef = useRef<HTMLDivElement>(null);
  const prevSpecCountRef = useRef(-1);

  // Fetch debate state
  const fetchDebate = useCallback(async () => {
    const res = await fetch(`/api/debates/${challengeId}`);
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    if (!res.ok) return;
    const data: DebateState = await res.json();
    setDebate(data);
    setLoading(false);
  }, [challengeId]);

  // Polling + Pusher
  useEffect(() => {
    fetchDebate();
    const poll = setInterval(fetchDebate, 2000);

    const pusher = getPusherClient();
    if (pusher) {
      const channel = pusher.subscribe(`debate-${challengeId}`);
      channel.bind("debate:state-changed", fetchDebate);
      channel.bind("debate:turn-submitted", fetchDebate);
      channel.bind("debate:second-chance", fetchDebate);
      channel.bind("spectator:message", fetchDebate);
    }

    return () => {
      clearInterval(poll);
      if (getPusherClient()) getPusherClient()!.unsubscribe(`debate-${challengeId}`);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDebate, challengeId]);

  // Reset draft and auto-submit guard when turn advances
  useEffect(() => {
    autoSubmittedRef.current = false;
    setDraft("");
    setTurnError("");
  }, [debate?.currentTurnIndex]);

  // Spectator chat scroll — only on new messages, not initial load
  useEffect(() => {
    if (!debate) return;
    const count = debate.spectatorMessages.length;
    if (prevSpecCountRef.current === -1) { prevSpecCountRef.current = count; return; }
    if (count > prevSpecCountRef.current) {
      specEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevSpecCountRef.current = count;
  }, [debate?.spectatorMessages]);

  // Timer countdown values
  const timerEndMs = debate?.phase === "typing" && debate.timerStartedAt
    ? new Date(debate.timerStartedAt).getTime() + debate.timerPreset * 1000
    : null;
  const timerLeft = useCountdown(timerEndMs);

  // Track whether the turn timer has actually started ticking > 0
  // to avoid false auto-submit on the very first render (timerLeft initialises to 0)
  const hasTimerRunRef = useRef(false);
  useEffect(() => {
    if (timerLeft > 0) hasTimerRunRef.current = true;
  }, [timerLeft]);
  // Reset when the turn advances (autoSubmittedRef is also reset at this point)
  useEffect(() => {
    hasTimerRunRef.current = false;
  }, [debate?.currentTurnIndex]);

  const prepEndMs = debate?.phase === "prep" && debate.prepEndsAt
    ? new Date(debate.prepEndsAt).getTime()
    : null;
  const prepLeft = useCountdown(prepEndMs);

  const scEndMs = debate?.phase === "second_chance" && debate.secondChanceExpiresAt
    ? new Date(debate.secondChanceExpiresAt).getTime()
    : null;
  const scLeft = useCountdown(scEndMs);

  const me = session?.user?.id;
  const isMyTurn = debate?.phase === "typing" && debate.currentUserId === me;

  // Auto-submit when my timer hits zero — only after it has been > 0
  useEffect(() => {
    if (timerLeft === 0 && isMyTurn && !autoSubmittedRef.current && hasTimerRunRef.current) {
      autoSubmittedRef.current = true;
      void submitTurn(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerLeft, isMyTurn]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function submitTurn(auto = false) {
    if (submitting) return;
    if (!auto && draft.trim().length < MIN_CHARS) {
      setTurnError(`Minimum ${MIN_CHARS} characters required.`);
      return;
    }
    setTurnError("");
    setSubmitting(true);
    try {
      await fetch(`/api/debates/${challengeId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim(), autoSubmit: auto }),
      });
      await fetchDebate();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmForfeit() {
    setForfeiting(true);
    try {
      await fetch(`/api/debates/${challengeId}/forfeit`, { method: "POST" });
      await fetchDebate();
    } finally {
      setForfeiting(false);
      setShowForfeitModal(false);
    }
  }

  async function respondSecondChance(action: "approve" | "deny") {
    setScLoading(true);
    try {
      await fetch(`/api/debates/${challengeId}/second-chance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await fetchDebate();
    } finally {
      setScLoading(false);
    }
  }

  async function sendSpecMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!specDraft.trim() || sendingSpec) return;
    setSendingSpec(true);
    try {
      await fetch(`/api/debates/${challengeId}/spectator-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: specDraft.trim(), guestName: guestName || "Guest" }),
      });
      setSpecDraft("");
      await fetchDebate();
    } finally {
      setSendingSpec(false);
    }
  }

  // ── Render guards ────────────────────────────────────────────────────────────

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-foreground-muted mb-4">Debate not found.</p>
        <Link href="/debates"><Button variant="outline">Browse Debates</Button></Link>
      </div>
    );
  }

  if (!debate) return null;

  const isParticipant = me === debate.debaterAId || me === debate.debaterBId;
  // debaterA (challenge creator) is always proposition
  const propositionUser = debate.debaterA;
  const oppositionUser = debate.debaterB;
  const totalVotes = Object.values(debate.audienceVotes).reduce((a, b) => a + b, 0);

  // Judge derivations (used when completed)
  const judgeResult =
    debate.judgeResults.find((r) => r.judgeId === "consensus") ??
    debate.judgeResults[0] ??
    null;
  const individualJudgeResults = debate.judgeResults.filter(
    (r) => !["consensus", "stub", "fallback", "forfeit"].includes(r.judgeId),
  );
  const winnerUser =
    debate.winnerId === debate.debaterAId
      ? debate.debaterA
      : debate.winnerId === debate.debaterBId
        ? debate.debaterB
        : null;
  const myPrivateFeedback =
    me === debate.debaterAId
      ? (judgeResult?.privateFeedbackA ?? null)
      : me === debate.debaterBId
        ? (judgeResult?.privateFeedbackB ?? null)
        : null;

  const sequence =
    debate.coinFlipWinnerId
      ? getTurnSequence(debate.format, debate.coinFlipWinnerId, debate.debaterAId, debate.debaterBId)
      : [];
  const currentSpec = sequence[debate.currentTurnIndex];

  // Group submitted turns by round
  const roundGroups: Record<RoundName, Turn[]> = { opening: [], rebuttal: [], closing: [] };
  for (const t of debate.turns) {
    roundGroups[t.roundName as RoundName].push(t);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1.5">
          <Badge variant="default">{debate.category.emoji} {debate.category.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {debate.phase !== "completed"
              ? <Badge variant="live">LIVE</Badge>
              : <Badge variant="success">Completed</Badge>}
            {debate.ranked && <Badge variant="brand">Ranked</Badge>}
            <Badge variant="default">{debate.format === "quick" ? "Quick" : "Standard"}</Badge>
          </div>
          {isParticipant && debate.phase !== "completed" && (
            <button
              onClick={() => setShowForfeitModal(true)}
              className="text-xs text-danger border border-danger/40 rounded-[--radius] px-3 py-1 hover:bg-danger/10 transition-colors"
            >
              Forfeit
            </button>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
          &ldquo;{debate.motion}&rdquo;
        </h1>
      </div>

      <div className="flex flex-col gap-6">

          {/* Participants bar — no avatar */}
          <Card>
            <CardBody className="py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/users/${propositionUser.username}`} className="font-semibold text-foreground text-sm truncate hover:text-brand transition-colors block">{propositionUser.username}</Link>
                  <p className="text-xs text-brand font-medium">Proposition (For)</p>
                </div>
                <div className="shrink-0 text-foreground-subtle font-bold text-xs px-2">VS</div>
                <div className="flex-1 min-w-0 text-right">
                  <Link href={`/users/${oppositionUser.username}`} className="font-semibold text-foreground text-sm truncate hover:text-brand transition-colors block">{oppositionUser.username}</Link>
                  <p className="text-xs text-danger font-medium">Opposition (Against)</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Prep phase */}
          {debate.phase === "prep" && (
            <Card>
              <CardBody className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-4">
                  <Clock size={22} className="text-accent" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-1">Preparation Phase</h2>
                <p className="text-foreground-muted text-sm mb-4">
                  Read the motion and collect your thoughts. Debate begins in&hellip;
                </p>
                <p className="text-3xl font-mono font-bold text-accent">{formatTimer(prepLeft)}</p>
                {isParticipant && (
                  <div className="mt-4 p-3 rounded-[--radius] bg-brand/10 border border-brand/20">
                    <p className="text-sm text-brand font-medium">
                      You argue:{" "}
                      {me === propositionUser.id
                        ? "🟢 Proposition — in support of the motion"
                        : "🔴 Opposition — against the motion"}
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Typing phase */}
          {debate.phase === "typing" && currentSpec && (
            <Card>
              <CardBody className="py-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                      {ROUND_LABEL[currentSpec.roundName as RoundName]}
                    </span>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {debate.currentUserId === me
                        ? "Your turn to write"
                        : `Waiting for ${currentSpec.userId === debate.debaterAId ? debate.debaterA.username : debate.debaterB.username}\u2026`}
                    </p>
                  </div>
                  {/* Timer */}
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-lg font-mono font-bold ${timerLeft < 30 ? "text-danger" : "text-foreground"}`}
                    >
                      {formatTimer(timerLeft)}
                    </span>
                    <div className="w-24 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: debate.timerPreset > 0
                            ? `${Math.min(100, (timerLeft / debate.timerPreset) * 100)}%`
                            : "0%",
                          backgroundColor: timerLeft < 30 ? "var(--danger)" : "var(--brand)",
                          transition: "width 1s linear, background-color 0.3s",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Opponent typing indicator */}
                {debate.currentUserId !== me && (
                  <div className="flex items-center gap-2 p-4 rounded-[--radius] bg-surface-raised border border-border">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-foreground-muted inline-block"
                          style={{ animation: `dot-bounce 1.2s ${i * 0.2}s ease-in-out infinite` }}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-foreground-muted">
                      {currentSpec.userId === debate.debaterAId
                        ? debate.debaterA.username
                        : debate.debaterB.username}{" "}
                      is writing&hellip;
                    </span>
                  </div>
                )}

                {/* My turn textarea */}
                {debate.currentUserId === me && (
                  <div className="flex flex-col gap-3">
                    <textarea
                      className="w-full min-h-[180px] p-4 rounded-[--radius] bg-surface-raised border border-border text-foreground placeholder:text-foreground-subtle resize-y focus:outline-none focus:border-brand transition-colors text-sm"
                      placeholder={`Write your ${ROUND_LABEL[currentSpec.roundName as RoundName].toLowerCase()} here\u2026`}
                      value={draft}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_CHARS) {
                          setDraft(e.target.value);
                          setTurnError("");
                        }
                      }}
                      disabled={submitting}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground-muted">
                        {draft.length}/{MAX_CHARS}
                        {draft.length > 0 && draft.length < MIN_CHARS && (
                          <span className="text-warning ml-2">
                            ({MIN_CHARS - draft.length} more to submit)
                          </span>
                        )}
                      </span>
                      <Button
                        onClick={() => submitTurn(false)}
                        disabled={submitting || draft.trim().length < MIN_CHARS}
                        size="sm"
                      >
                        <Send size={14} className="mr-1.5" />
                        Submit Early
                      </Button>
                    </div>
                    {turnError && <p className="text-danger text-xs">{turnError}</p>}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Second-chance */}
          {debate.phase === "second_chance" && (
            <Card>
              <CardBody className="py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-warning/15 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={22} className="text-warning" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">Second Chance Requested</h2>

                {me === debate.secondChanceRequesterId ? (
                  <>
                    <p className="text-foreground-muted text-sm mb-3">
                      Waiting for your opponent to respond&hellip;
                    </p>
                    <p className="text-warning font-mono text-xl font-bold">{formatTimer(scLeft)}</p>
                  </>
                ) : isParticipant ? (
                  <>
                    <p className="text-foreground-muted text-sm mb-1">
                      Your opponent submitted nothing and is requesting another chance.
                    </p>
                    <p className="text-warning text-sm font-semibold mb-4">
                      Expires in {formatTimer(scLeft)}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => respondSecondChance("deny")}
                        disabled={scLoading}
                      >
                        Deny (forfeit them)
                      </Button>
                      <Button
                        onClick={() => respondSecondChance("approve")}
                        disabled={scLoading}
                      >
                        <CheckCircle size={14} className="mr-1.5" />
                        Approve
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-foreground-muted text-sm">
                    A second-chance request is pending decision&hellip;
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Official Result (completed only) */}
          {debate.phase === "completed" && (
            <Card>
              <CardBody>
                <div className="flex items-center gap-2 mb-3">
                  <Gavel size={15} className="text-brand" />
                  <span className="font-semibold text-foreground text-sm">Official Result</span>
                  <Badge variant="info" size="sm">AI Judge</Badge>
                </div>
                {judgeResult ? (
                  judgeResult.winnerId ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy size={16} className="text-accent" />
                        <span className="font-bold text-foreground">
                          {judgeResult.winnerId === debate.debaterAId
                            ? debate.debaterA.username
                            : debate.debaterB.username}{" "}
                          wins
                        </span>
                      </div>
                      <p className="text-sm text-foreground-muted leading-relaxed">{judgeResult.explanation}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🤝</span>
                        <span className="font-bold text-foreground">Tie</span>
                      </div>
                      <p className="text-sm text-foreground-muted leading-relaxed">{judgeResult.explanation}</p>
                    </div>
                  )
                ) : winnerUser && (judgeResult || debate.forfeitedBy) ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy size={16} className="text-accent" />
                      <span className="font-bold text-foreground">{winnerUser.username} wins</span>
                    </div>
                    <p className="text-sm text-foreground-muted">
                      {debate.forfeitedBy ? "Won by forfeit." : "Winner determined by AI judges"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-foreground-muted">AI judging is in progress\u2026</p>
                )}
                {debate.forfeitedBy && (
                  <div className="mt-3 p-2 rounded-md bg-danger/10 border border-danger/20">
                    <p className="text-xs text-danger font-medium">
                      {debate.forfeitedBy === debate.debaterAId
                        ? debate.debaterA.username
                        : debate.debaterB.username}{" "}
                      forfeited \u2014 win awarded to opponent.
                    </p>
                  </div>
                )}
                {myPrivateFeedback && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-foreground mb-1.5">🔒 Your Private Feedback</p>
                    <p className="text-sm text-foreground-muted leading-relaxed">{myPrivateFeedback}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Full Transcript */}
          {debate.turns.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-foreground mb-4">Full Transcript</h2>
              <div className="flex flex-col gap-6">
              {(["opening", "rebuttal", "closing"] as RoundName[]).map((round) => {
                const turns = roundGroups[round];
                if (turns.length === 0) return null;
                return (
                  <div key={round}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wide px-2">
                        {ROUND_LABEL[round]}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="flex flex-col gap-3">
                      {turns.map((turn) => {
                        const isA = turn.userId === debate.debaterAId;
                        const speaker = isA ? debate.debaterA : debate.debaterB;
                        const isProp = speaker.id === propositionUser.id;
                        return (
                          <div key={turn.id} className={`flex gap-3 ${isA ? "flex-row" : "flex-row-reverse"}`}>
                            <Link href={`/users/${speaker.username}`} className="shrink-0 mt-1 hover:opacity-80 transition-opacity">
                              <Avatar initial={speaker.username[0]} size="sm" />
                            </Link>
                            <div
                              className={`max-w-[85%] rounded-[--radius-lg] px-4 py-3 ${
                                isA
                                  ? "bg-surface-raised border border-border rounded-tl-none"
                                  : "bg-brand-dim border border-brand/20 rounded-tr-none"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <Link href={`/users/${speaker.username}`} className="text-xs font-semibold text-foreground hover:text-brand transition-colors">{speaker.username}</Link>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wide ${isProp ? "text-brand" : "text-danger"}`}
                                >
                                  {isProp ? "PROP" : "OPP"}
                                </span>
                                {turn.isAutoSubmit && (
                                  <span className="text-[10px] text-foreground-muted italic">auto-submitted</span>
                                )}
                              </div>
                              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {turn.content}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Judge Panel (completed only) */}
          {debate.phase === "completed" && individualJudgeResults.length > 1 && (
            <div>
              <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                <Gavel size={15} className="text-brand" />
                Judge Panel
              </h2>
              <div className="flex flex-col gap-2">
                {individualJudgeResults.map((jr, i) => {
                  const roundScoresParsed: Array<{ round: string; aScore: number; bScore: number; aFactual?: number; bFactual?: number; reasoning: string }> =
                    (() => { try { return JSON.parse(jr.roundScores); } catch { return []; } })();
                  let panelWinner =
                    jr.winnerId === debate.debaterAId
                      ? debate.debaterA
                      : jr.winnerId === debate.debaterBId
                        ? debate.debaterB
                        : null;
                  let inferredFromScores = false;
                  if (!panelWinner && roundScoresParsed.length > 0) {
                    const totalA = roundScoresParsed.reduce((s, r) => s + r.aScore, 0);
                    const totalB = roundScoresParsed.reduce((s, r) => s + r.bScore, 0);
                    panelWinner = totalA >= totalB ? debate.debaterA : debate.debaterB;
                    inferredFromScores = true;
                  }
                  const display = JUDGE_DISPLAY[jr.judgeId] ?? { label: `Judge ${i + 1}`, accent: "text-foreground-muted" };
                  return (
                    <details key={jr.id} className="group rounded-[--radius] border border-border bg-surface overflow-hidden">
                      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-surface-raised transition-colors">
                        <span className={`text-xs font-bold uppercase tracking-wide w-20 shrink-0 ${display.accent}`}>
                          {display.label}
                        </span>
                        {panelWinner ? (
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Trophy size={13} className="text-accent shrink-0" />
                            {panelWinner.username} wins
                            {inferredFromScores && (
                              <span className="text-[10px] font-normal text-foreground-muted">(by score)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-foreground-muted">No verdict</span>
                        )}
                        <span className="ml-auto text-xs text-foreground-subtle group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="px-4 pb-4 pt-1 border-t border-border bg-surface-raised">
                        <p className="text-sm text-foreground-muted leading-relaxed mb-4">{jr.explanation}</p>
                        {roundScoresParsed.length > 0 && (
                          <div className="flex flex-col gap-4">
                            {roundScoresParsed.map((rs) => {
                              const hasFactual = rs.aFactual !== undefined && rs.bFactual !== undefined;
                              return (
                                <div key={rs.round}>
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle mb-2">{rs.round}</p>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle mb-1 opacity-60">Overall</p>
                                  <div className="flex items-center gap-3 mb-1">
                                    <span className="text-xs text-foreground w-20 truncate">{debate.debaterA.username}</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(rs.aScore / 10) * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-foreground-muted w-6 text-right">{rs.aScore}</span>
                                  </div>
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="text-xs text-foreground w-20 truncate">{debate.debaterB.username}</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                                      <div className="h-full rounded-full bg-danger transition-all" style={{ width: `${(rs.bScore / 10) * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-foreground-muted w-6 text-right">{rs.bScore}</span>
                                  </div>
                                  {hasFactual && (
                                    <>
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500 mb-1 opacity-80">Fact Check</p>
                                      <div className="flex items-center gap-3 mb-1">
                                        <span className="text-xs text-foreground w-20 truncate">{debate.debaterA.username}</span>
                                        <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                                          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${((rs.aFactual ?? 0) / 10) * 100}%` }} />
                                        </div>
                                        <span className="text-xs font-mono text-foreground-muted w-6 text-right">{rs.aFactual}</span>
                                      </div>
                                      <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs text-foreground w-20 truncate">{debate.debaterB.username}</span>
                                        <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                                          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${((rs.bFactual ?? 0) / 10) * 100}%` }} />
                                        </div>
                                        <span className="text-xs font-mono text-foreground-muted w-6 text-right">{rs.bFactual}</span>
                                      </div>
                                    </>
                                  )}
                                  {rs.reasoning && (
                                    <p className="text-xs text-foreground-subtle italic">{rs.reasoning}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audience Pick (completed only) */}
          {debate.phase === "completed" && (
            <AudienceVotePanel
              challengeId={challengeId}
              debate={debate}
              totalVotes={totalVotes}
              me={me}
              onVote={fetchDebate}
            />
          )}

          {/* Comments (completed only) */}
          {debate.phase === "completed" && (
            <CommentsSection challengeId={challengeId} />
          )}

          {/* Spectator Chat (live only) */}
          {debate.phase !== "completed" && (
            <Card>
              <CardBody className="p-0 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                  <Eye size={13} className="text-foreground-muted" />
                  <span className="text-xs font-semibold text-foreground">Spectator Chat</span>
                  {!debate.isPublic && <Badge variant="default" size="sm">Private</Badge>}
                </div>

                <div
                  className="flex flex-col gap-1.5 p-3 overflow-y-auto"
                  style={{ minHeight: "120px", maxHeight: "260px" }}
                >
                  {debate.spectatorMessages.length === 0 && (
                    <p className="text-xs text-foreground-subtle text-center py-4">No messages yet.</p>
                  )}
                  {debate.spectatorMessages.map((m) => (
                    <div key={m.id} className="text-xs">
                      <span className="font-semibold text-foreground mr-1">{m.username}:</span>
                      <span className="text-foreground-muted break-words">{m.content}</span>
                    </div>
                  ))}
                  <div ref={specEndRef} />
                </div>

                {isParticipant && debate.status === "active" ? (
                  <div className="px-3 py-2 border-t border-border">
                    <p className="text-xs text-foreground-muted italic text-center">
                      Participants cannot chat here while debating.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={sendSpecMessage} className="px-3 py-2 border-t border-border flex flex-col gap-1.5">
                    {!session && (
                      <input
                        className="w-full text-xs px-2 py-1 rounded-md bg-surface-raised border border-border text-foreground placeholder:text-foreground-subtle focus:outline-none"
                        placeholder="Your name (optional)"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value.slice(0, 30))}
                      />
                    )}
                    <div className="flex gap-1.5">
                      <input
                        className="flex-1 text-xs px-2 py-1 rounded-md bg-surface-raised border border-border text-foreground placeholder:text-foreground-subtle focus:outline-none min-w-0"
                        placeholder="Say something\u2026"
                        value={specDraft}
                        onChange={(e) => setSpecDraft(e.target.value.slice(0, 500))}
                        disabled={sendingSpec}
                      />
                      <button
                        type="submit"
                        className="p-1.5 rounded-md bg-brand/20 text-brand hover:bg-brand/30 transition-colors disabled:opacity-40"
                        disabled={sendingSpec || !specDraft.trim()}
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  </form>
                )}
              </CardBody>
            </Card>
          )}

        </div>

      {/* Forfeit confirmation modal */}
      <Modal
        open={showForfeitModal}
        onClose={() => !forfeiting && setShowForfeitModal(false)}
        width="max-w-sm"
      >
        <div className="px-6 py-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
            <AlertTriangle size={22} className="text-danger" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground mb-1">Forfeit this debate?</h2>
            <p className="text-sm text-foreground-muted">Your opponent will be awarded the win. This cannot be undone.</p>
          </div>
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowForfeitModal(false)}
              disabled={forfeiting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={confirmForfeit}
              disabled={forfeiting}
            >
              {forfeiting ? "Forfeiting..." : "Yes, forfeit"}
            </Button>
          </div>
        </div>
      </Modal>

      <style>{`
        @keyframes dot-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Audience Vote Panel ───────────────────────────────────────────────────────

function AudienceVotePanel({
  challengeId,
  debate,
  totalVotes,
  me,
  onVote,
}: {
  challengeId: string;
  debate: DebateState;
  totalVotes: number;
  me: string | undefined;
  onVote: () => void;
}) {
  const [voted, setVoted] = useState<string | null>(null);
  const [voteLoading, setVoteLoading] = useState(false);

  const isDebater = me === debate.debaterAId || me === debate.debaterBId;

  useEffect(() => {
    const stored = localStorage.getItem(`vote-${debate.id}`);
    if (stored) setVoted(stored);
  }, [debate.id]);

  async function castVote(userId: string) {
    if (voteLoading) return;
    setVoteLoading(true);
    let voterToken = me;
    if (!voterToken) {
      voterToken = localStorage.getItem("voter_id") ?? undefined;
      if (!voterToken) {
        voterToken = crypto.randomUUID();
        localStorage.setItem("voter_id", voterToken);
      }
    }
    try {
      const res = await fetch(`/api/debates/${challengeId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votedForId: userId, voterToken }),
      });
      const json = await res.json();
      if (json.removed) {
        // Vote was toggled off
        setVoted(null);
        localStorage.removeItem(`vote-${debate.id}`);
      } else {
        setVoted(userId);
        localStorage.setItem(`vote-${debate.id}`, userId);
      }
      onVote();
    } finally {
      setVoteLoading(false);
    }
  }

  const pct = (userId: string) =>
    totalVotes === 0 ? 0 : Math.round(((debate.audienceVotes[userId] ?? 0) / totalVotes) * 100);
  const propositionId = debate.coinFlipWinnerId!;

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-2">
          <ThumbsUp size={13} className="text-accent" />
          <span className="text-sm font-semibold text-foreground">Audience Pick</span>
          <span className="text-xs text-foreground-muted ml-auto">{totalVotes} votes</span>
        </div>
        <p className="text-xs text-foreground-muted mb-3">Separate from the official AI judge.</p>

        {isDebater ? (
          <p className="text-xs text-foreground-muted italic text-center py-2">Participants cannot vote in their own debate.</p>
        ) : [debate.debaterA, debate.debaterB].map((d) => {
          const isProp = d.id === propositionId;
          const p = pct(d.id);
          const isMyVote = voted === d.id;
          const isOtherVote = voted !== null && voted !== d.id;
          return (
            <button
              key={d.id}
              onClick={() => castVote(d.id)}
              disabled={voteLoading}
              title={isMyVote ? "Click again to remove your vote" : isOtherVote ? "Transfer your vote here" : undefined}
              className={`w-full flex items-center gap-2 mb-2 p-2 rounded-[--radius] border transition-colors text-left ${
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
                    {isMyVote && <span className="ml-1.5 text-[10px] text-accent font-semibold">✓ your vote</span>}
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
          );
        })}

        {!isDebater && !voted && (
          <p className="text-xs text-foreground-muted text-center mt-1">Click to cast your vote</p>
        )}
        {!isDebater && voted && (
          <p className="text-xs text-foreground-muted text-center mt-1">Click your pick again to remove · click the other to transfer</p>
        )}
      </CardBody>
    </Card>
  );
}
