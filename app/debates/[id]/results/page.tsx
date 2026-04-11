import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { ROUND_LABEL, type RoundName } from "@/lib/debate-state";
import { CommentsSection } from "./CommentsSection";
import { AudienceVotePanel } from "./AudienceVotePanel";
import { Trophy, Gavel, Users, CheckCircle2, XCircle, AlertCircle, HelpCircle, Scale } from "lucide-react";
import { PrivateFeedbackView } from "@/components/debate/PrivateFeedbackView";
import { PrivateFeedbackSection } from "./PrivateFeedbackSection";
import type { DebaterScores, EvidenceCheck } from "@/lib/judging/types";
import type { Metadata } from "next";

const SCORE_DIMS: Array<{ key: keyof Omit<DebaterScores, "final_score">; label: string; weight: string }> = [
  { key: "factuality",        label: "Factuality",        weight: "35%" },
  { key: "evidence_quality",  label: "Evidence Quality",  weight: "25%" },
  { key: "argument_strength", label: "Argument Strength", weight: "15%" },
  { key: "rebuttal_quality",  label: "Rebuttal Quality",  weight: "15%" },
  { key: "clarity",           label: "Clarity",           weight: "5%"  },
  { key: "persuasiveness",    label: "Persuasiveness",    weight: "5%"  },
];

/** Maps stored judgeId → display label and accent colour class */
const JUDGE_DISPLAY: Record<string, { label: string; accent: string }> = {
  "judge-grok": { label: "Grok", accent: "text-emerald-500" },
  "judge-claude": { label: "Claude", accent: "text-violet-500" },
  "judge-arbiter": { label: "ChatGPT", accent: "text-brand" },
};

const VERDICT_CONFIG = {
  correct:     { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20",   label: "Correct" },
  incorrect:   { icon: XCircle,      color: "text-danger",      bg: "bg-danger/10 border-danger/20",             label: "Incorrect" },
  misleading:  { icon: AlertCircle,  color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20",       label: "Misleading" },
  disputed:    { icon: Scale,        color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/20",     label: "Disputed" },
  unsupported: { icon: HelpCircle,   color: "text-foreground-muted", bg: "bg-surface-raised border-border",     label: "Unsupported" },
} as const;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: challengeId } = await params;
  const debate = await db.debate.findUnique({ where: { challengeId }, select: { motion: true } });
  return { title: debate ? `Results: ${debate.motion.slice(0, 50)}` : "Results" };
}


export default async function ResultsPage({ params }: Props) {
  const { id: challengeId } = await params;
  const session = await auth();
  const sessionUserId = (session?.user as { id?: string })?.id;
  const sessionRole = (session?.user as { role?: string })?.role;

  const debate = await db.debate.findUnique({
    where: { challengeId },
    include: {
      debaterA: { select: { id: true, username: true, avatarUrl: true, elo: true, isDeleted: true } },
      debaterB: { select: { id: true, username: true, avatarUrl: true, elo: true, isDeleted: true } },
      category: { select: { id: true, label: true, emoji: true, slug: true } },
      turns: { orderBy: { submittedAt: "asc" } },
      judgeResults: true,
      audienceVotes: { select: { votedForId: true } },
    },
  });

  if (!debate || debate.status !== "completed") notFound();

  // Audience vote tally — passed to client AudienceVotePanel
  const voteTally: Record<string, number> = {};
  for (const v of debate.audienceVotes) {
    voteTally[v.votedForId] = (voteTally[v.votedForId] ?? 0) + 1;
  }

  const propositionUser =
    debate.coinFlipWinnerId === debate.debaterAId ? debate.debaterA : debate.debaterB;
  const oppositionUser =
    propositionUser.id === debate.debaterAId ? debate.debaterB : debate.debaterA;

  const winner =
    debate.winnerId === debate.debaterAId
      ? debate.debaterA
      : debate.winnerId === debate.debaterBId
        ? debate.debaterB
        : null;

  // Group turns by round
  const roundGroups: Record<RoundName, typeof debate.turns> = {
    opening: [],
    rebuttal: [],
    closing: [],
  };
  for (const t of debate.turns) {
    roundGroups[t.roundName as RoundName].push(t);
  }

  const judgeResult = debate.judgeResults.find((r) => r.judgeId === "consensus") ?? debate.judgeResults[0] ?? null;
  const individualJudgeResults = debate.judgeResults.filter(
    (r) => r.judgeId !== "consensus" && r.judgeId !== "stub" && r.judgeId !== "fallback" && r.judgeId !== "forfeit",
  );

  // Parse evidence checks from consensus result
  const consensusEvidenceChecks: EvidenceCheck[] = (() => {
    try {
      const raw = (judgeResult as { evidenceChecks?: string | null } | null)?.evidenceChecks;
      return raw ? JSON.parse(raw) : [];
    }
    catch { return []; }
  })();

  // Parse per-debater scores from consensus roundScores
  const consensusScores: {
    scoresA: DebaterScores | null;
    scoresB: DebaterScores | null;
    biggestMistakeA: string | null;
    biggestAchievementA: string | null;
    biggestMistakeB: string | null;
    biggestAchievementB: string | null;
    improvementA: string | null;
    improvementB: string | null;
  } = (() => {
    try {
      const raw = (judgeResult as { roundScores?: string | null } | null)?.roundScores;
      if (!raw) return { scoresA: null, scoresB: null, biggestMistakeA: null, biggestAchievementA: null, biggestMistakeB: null, biggestAchievementB: null, improvementA: null, improvementB: null };
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { scoresA: null, scoresB: null, biggestMistakeA: null, biggestAchievementA: null, biggestMistakeB: null, biggestAchievementB: null, improvementA: null, improvementB: null }; // legacy format
      return {
        scoresA: parsed.scoresA ?? null,
        scoresB: parsed.scoresB ?? null,
        biggestMistakeA: parsed.biggestMistakeA ?? null,
        biggestAchievementA: parsed.biggestAchievementA ?? null,
        biggestMistakeB: parsed.biggestMistakeB ?? null,
        biggestAchievementB: parsed.biggestAchievementB ?? null,
        improvementA: parsed.improvementA ?? null,
        improvementB: parsed.improvementB ?? null,
      };
    } catch { return { scoresA: null, scoresB: null, biggestMistakeA: null, biggestAchievementA: null, biggestMistakeB: null, biggestAchievementB: null, improvementA: null, improvementB: null }; }
  })();

  // Private feedback for the current user
  const isAdmin = sessionRole === "admin";
  const isDebaterA = sessionUserId === debate.debaterAId;
  const isDebaterB = sessionUserId === debate.debaterBId;
  const myPrivateFeedback =
    isDebaterA
      ? judgeResult?.privateFeedbackA
      : isDebaterB
        ? judgeResult?.privateFeedbackB
        : null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="default">{debate.category.emoji} {debate.category.label}</Badge>
          <Badge variant="success">Completed</Badge>
          {debate.ranked && <Badge variant="brand">Ranked</Badge>}
          {debate.forfeitedBy && <Badge variant="danger">Forfeit</Badge>}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug">
          &ldquo;{debate.motion}&rdquo;
        </h1>
      </div>

      {/* Participants */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-4">
            <Link href={`/users/${propositionUser.username}`} className="flex-1 flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Avatar initial={propositionUser.username[0]} size="lg" />
              <div>
                <p className="font-bold text-foreground">{propositionUser.username}</p>
                <p className="text-xs text-brand font-medium">Proposition</p>
                <p className="text-xs text-foreground-muted">{propositionUser.elo} ELO</p>
              </div>
            </Link>
            <span className="text-2xl font-black text-foreground-subtle shrink-0">VS</span>
            <Link href={`/users/${oppositionUser.username}`} className="flex-1 flex items-center gap-3 justify-end text-right hover:opacity-80 transition-opacity">
              <div>
                <p className="font-bold text-foreground">{oppositionUser.username}</p>
                <p className="text-xs text-danger font-medium">Opposition</p>
                <p className="text-xs text-foreground-muted">{oppositionUser.elo} ELO</p>
              </div>
              <Avatar initial={oppositionUser.username[0]} size="lg" />
            </Link>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-6 mb-8">
        {/* Official result */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-3">
              <Gavel size={16} className="text-brand" />
              <span className="font-semibold text-foreground text-sm">Official Result</span>
              <Badge variant="info" size="sm">AI Judges</Badge>
            </div>

            {judgeResult ? (
              judgeResult.winnerId ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy size={18} className="text-accent" />
                    <span className="font-bold text-foreground">
                      {judgeResult.winnerId === debate.debaterAId
                        ? debate.debaterA.username
                        : debate.debaterB.username}{" "}
                      wins
                    </span>
                  </div>
                  {judgeResult.explanation && (
                    <p className="text-sm text-foreground-muted mt-2 leading-relaxed">{judgeResult.explanation}</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🤝</span>
                    <span className="font-bold text-foreground">Tie</span>
                  </div>
                  {judgeResult.explanation && (
                    <p className="text-sm text-foreground-muted mt-2 leading-relaxed">{judgeResult.explanation}</p>
                  )}
                </div>
              )
            ) : winner && debate.forfeitedBy ? (
              // Only show winner immediately for forfeit cases
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={18} className="text-accent" />
                  <span className="font-bold text-foreground">{winner.username} wins</span>
                </div>
                <p className="text-xs text-foreground-muted">Won by forfeit.</p>
              </div>
            ) : winner ? (
              // If there's a winner but no judge result, judging is in progress
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="animate-spin h-4 w-4 border-2 border-brand border-t-transparent rounded-full"></div>
                  <span className="font-semibold text-foreground">AI judging in progress...</span>
                </div>
                <p className="text-xs text-foreground-muted">Results will be available shortly.</p>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">No judge result available yet.</p>
            )}

            {debate.forfeitedBy && (
              <div className="mt-3 p-2 rounded-md bg-danger/10 border border-danger/20">
                <p className="text-xs text-danger font-medium">
                  {debate.forfeitedBy === debate.debaterAId
                    ? debate.debaterA.username
                    : debate.debaterB.username}{" "}
                  forfeited — win awarded to opponent.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Audience Pick — interactive voting */}
        <AudienceVotePanel
          challengeId={challengeId}
          debateId={debate.id}
          debaterA={debate.debaterA}
          debaterB={debate.debaterB}
          initialVotes={voteTally}
          isParticipant={isDebaterA || isDebaterB}
        />
      </div>

      {/* Private Feedback — visible to each debater (their own) and admins (both) */}
      {(isDebaterA || isDebaterB || isAdmin) && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-3">Private Feedback</h2>
          {isAdmin ? (
            <div className="flex flex-col gap-3">
              <Card>
                <CardBody>
                  <p className="text-xs font-semibold text-brand mb-2">{debate.debaterA.username}</p>
                  {judgeResult?.privateFeedbackA ? (
                    <PrivateFeedbackView text={judgeResult.privateFeedbackA} />
                  ) : (
                    <p className="text-sm text-foreground-muted italic">Not generated yet.</p>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <p className="text-xs font-semibold text-danger mb-2">{debate.debaterB.username}</p>
                  {judgeResult?.privateFeedbackB ? (
                    <PrivateFeedbackView text={judgeResult.privateFeedbackB} />
                  ) : (
                    <p className="text-sm text-foreground-muted italic">Not generated yet.</p>
                  )}
                </CardBody>
              </Card>
            </div>
          ) : (
            <Card>
              <CardBody>
                <PrivateFeedbackSection
                  challengeId={challengeId}
                  initialFeedback={myPrivateFeedback}
                />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ── Scorecard ──────────────────────────────────────────── */}
      {(consensusScores.scoresA || consensusScores.scoresB) && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span>📊</span> Scorecard
          </h2>
          <Card>
            <CardBody>
              {/* Header row with debater names and final scores */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-5 pb-4 border-b border-border">
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground-muted mb-1">{debate.debaterA.username}</p>
                  <p className={`text-3xl font-black tabular-nums ${
                    consensusScores.scoresA && consensusScores.scoresB
                      ? consensusScores.scoresA.final_score > consensusScores.scoresB.final_score
                        ? "text-brand"
                        : "text-foreground-muted"
                      : "text-foreground"
                  }`}>
                    {consensusScores.scoresA?.final_score.toFixed(1) ?? "—"}
                  </p>
                  <p className="text-[10px] text-foreground-subtle uppercase tracking-wide mt-0.5">Final Score</p>
                </div>
                <span className="text-sm font-bold text-foreground-subtle">vs</span>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground-muted mb-1">{debate.debaterB.username}</p>
                  <p className={`text-3xl font-black tabular-nums ${
                    consensusScores.scoresA && consensusScores.scoresB
                      ? consensusScores.scoresB.final_score > consensusScores.scoresA.final_score
                        ? "text-brand"
                        : "text-foreground-muted"
                      : "text-foreground"
                  }`}>
                    {consensusScores.scoresB?.final_score.toFixed(1) ?? "—"}
                  </p>
                  <p className="text-[10px] text-foreground-subtle uppercase tracking-wide mt-0.5">Final Score</p>
                </div>
              </div>

              {/* Dimension rows */}
              <div className="flex flex-col gap-3">
                {SCORE_DIMS.map(({ key, label, weight }) => {
                  const sA = consensusScores.scoresA?.[key] ?? null;
                  const sB = consensusScores.scoresB?.[key] ?? null;
                  const isFactuality = key === "factuality";
                  return (
                    <div key={key} className="grid grid-cols-[1fr_6rem_1fr] items-center gap-2">
                      {/* Debater A bar */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-2 rounded-full bg-surface-overlay overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              sA !== null && sA < 3 ? "bg-danger" :
                              sA !== null && sA < 5 ? "bg-amber-500" :
                              "bg-brand"
                            }`}
                            style={{ width: sA !== null ? `${sA * 10}%` : "0%" }}
                          />
                        </div>
                        <span className={`text-xs tabular-nums w-6 text-right font-medium ${
                          sA !== null && sA < 3 ? "text-danger" :
                          sA !== null && sA < 5 ? "text-amber-500" :
                          "text-foreground"
                        }`}>{sA?.toFixed(0) ?? "—"}</span>
                      </div>
                      {/* Dimension label */}
                      <div className="flex flex-col items-center text-center">
                        <span className={`text-[11px] font-semibold leading-tight ${isFactuality ? "text-foreground" : "text-foreground-muted"}`}>
                          {label}
                        </span>
                        <span className="text-[9px] text-foreground-subtle">{weight}</span>
                      </div>
                      {/* Debater B bar */}
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs tabular-nums w-6 font-medium ${
                          sB !== null && sB < 3 ? "text-danger" :
                          sB !== null && sB < 5 ? "text-amber-500" :
                          "text-foreground"
                        }`}>{sB?.toFixed(0) ?? "—"}</span>
                        <div className="flex-1 h-2 rounded-full bg-surface-overlay overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              sB !== null && sB < 3 ? "bg-danger" :
                              sB !== null && sB < 5 ? "bg-amber-500" :
                              "bg-brand"
                            }`}
                            style={{ width: sB !== null ? `${sB * 10}%` : "0%" }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </CardBody>
          </Card>
        </div>
      )}

      {/* ── Fact-Check Analysis ──────────────────────────────────── */}
      {judgeResult && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span>🔍</span> Fact-Check Analysis
          </h2>

          {/* Claim-by-claim checks */}
          {consensusEvidenceChecks.length > 0 && (
            <div>
              <div className="flex flex-col gap-2">
                {consensusEvidenceChecks.map((ec, idx) => {
                  const isA = ec.debater === debate.debaterA.username;
                  const cfg = VERDICT_CONFIG[ec.verdict as keyof typeof VERDICT_CONFIG] ?? VERDICT_CONFIG.unsupported;
                  const Icon = cfg.icon;
                  const importanceColor =
                    ec.importance === "central" ? "text-danger font-semibold" :
                    ec.importance === "supporting" ? "text-amber-500" :
                    "text-foreground-subtle";

                  return (
                    <div key={idx} className={`rounded-[--radius] border p-3 ${cfg.bg}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 ${cfg.color}`}><Icon size={14} /></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isA ? "bg-brand/20 text-brand" : "bg-danger/20 text-danger"}`}>
                              {ec.debater}
                            </span>
                            {ec.importance && (
                              <span className={`text-[10px] uppercase tracking-wide ${importanceColor}`}>
                                {ec.importance === "central" ? "⚠ Central claim" : ec.importance === "supporting" ? "Supporting" : "Peripheral"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground mb-1 leading-snug">&ldquo;{ec.claim}&rdquo;</p>
                          <p className="text-xs text-foreground-muted leading-relaxed">{ec.explanation}</p>
                          {ec.source && (
                            <p className="text-[10px] text-foreground-subtle mt-1 font-mono">Source: {ec.source}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Individual judge verdicts — simplified, no score bars */}
      {individualJudgeResults.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Users size={18} className="text-brand" />
            Judge Panel
          </h2>
          <div className="flex flex-col gap-2">
            {individualJudgeResults.map((jr, i) => {
              const panelWinner =
                jr.winnerId === debate.debaterAId
                  ? debate.debaterA
                  : jr.winnerId === debate.debaterBId
                    ? debate.debaterB
                    : null;
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
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-foreground-muted">No verdict</span>
                    )}
                    <span className="ml-auto text-xs text-foreground-subtle group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="px-4 pb-4 pt-3 border-t border-border bg-surface-raised">
                    {jr.explanation ? (
                      <div className="space-y-2">
                        {jr.explanation.split(/\n\n+/).map((para, pi) => (
                          <p key={pi} className="text-sm text-foreground-muted leading-relaxed">{para}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-foreground-muted italic">No detailed analysis available.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Transcript */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-foreground mb-4">Full Transcript</h2>

        {debate.turns.length === 0 ? (
          <Card><CardBody><p className="text-foreground-muted text-sm text-center py-4">No turns were recorded.</p></CardBody></Card>
        ) : (
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
                          <div className="shrink-0 mt-1">
                            <Avatar initial={speaker.username[0]} size="sm" />
                          </div>
                          <div
                            className={`max-w-[85%] rounded-[--radius-lg] px-4 py-3 ${
                              isA
                                ? "bg-surface-raised border border-border rounded-tl-none"
                                : "bg-brand-dim border border-brand/20 rounded-tr-none"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-foreground">{speaker.username}</span>
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
        )}
      </div>

      <CommentsSection challengeId={challengeId} />
    </div>
  );
}
