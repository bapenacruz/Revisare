import type { ConsensusResult, DebaterScores, JudgeInput, SingleJudgeVerdict } from "./types";
import { MockJudgingProvider } from "./mock-provider";
import { ArbiterJudgingProvider, ClaudeJudgingProvider, GrokJudgingProvider } from "./openrouter-provider";

/** Average two DebaterScores objects, recomputing final_score with the cap rules. */
function avgScores(a: DebaterScores | undefined, b: DebaterScores | undefined): DebaterScores | undefined {
  if (!a && !b) return undefined;
  const src = a && b ? null : (a ?? b)!;
  if (src) return src; // only one side available — return as-is
  const avg = (k: keyof Omit<DebaterScores, "final_score">) =>
    Math.round(((a![k] + b![k]) / 2) * 10) / 10;
  const factuality = avg("factuality");
  const evidence_quality = avg("evidence_quality");
  const argument_strength = avg("argument_strength");
  const rebuttal_quality = avg("rebuttal_quality");
  const clarity = avg("clarity");
  const persuasiveness = avg("persuasiveness");
  let final_score =
    factuality * 0.35 + evidence_quality * 0.25 + argument_strength * 0.15 +
    rebuttal_quality * 0.15 + clarity * 0.05 + persuasiveness * 0.05;
  if (factuality < 3) final_score = Math.min(final_score, 3);
  else if (factuality < 5) final_score = Math.min(final_score, 6);
  return { factuality, evidence_quality, argument_strength, rebuttal_quality, clarity, persuasiveness,
    final_score: Math.round(final_score * 10) / 10 };
}

/** Build a synthetic arbiter verdict from two phase-1 verdicts when the real Arbiter fails. */
function syntheticArbiter(
  a: SingleJudgeVerdict, b: SingleJudgeVerdict, input: JudgeInput,
): SingleJudgeVerdict {
  const winnerId = a.winnerId === b.winnerId ? a.winnerId : a.winnerId; // Grok casts deciding vote
  const evidenceChecks = [
    ...a.evidenceChecks,
    ...b.evidenceChecks.filter((ec) => !a.evidenceChecks.some((x) => x.claim === ec.claim)),
  ].slice(0, 10);
  return {
    winnerId,
    explanation: a.explanation || b.explanation,
    privateFeedbackA: a.privateFeedbackA || b.privateFeedbackA,
    privateFeedbackB: a.privateFeedbackB || b.privateFeedbackB,
    evidenceChecks,
    scoresA: avgScores(a.scoresA, b.scoresA),
    scoresB: avgScores(a.scoresB, b.scoresB),
    biggestMistakeA: a.biggestMistakeA || b.biggestMistakeA,
    biggestAchievementA: a.biggestAchievementA || b.biggestAchievementA,
    biggestMistakeB: a.biggestMistakeB || b.biggestMistakeB,
    biggestAchievementB: a.biggestAchievementB || b.biggestAchievementB,
    improvementA: a.improvementA || b.improvementA,
    improvementB: a.improvementB || b.improvementB,
  };
}

// ─── Judge configuration (for UI labelling) ────────────────────────────────

export interface JudgeConfig {
  id: string;
  label: string;
  /** Which env var holds this judge's API key */
  apiKeyEnv: string;
  /** Optional env var to override the model */
  modelEnv: string;
  defaultModel: string;
}

export const JUDGE_CONFIGS: JudgeConfig[] = [
  {
    id: "judge-grok",
    label: "Grok",
    apiKeyEnv: "JUDGE_A_API_KEY",
    modelEnv: "JUDGE_A_MODEL",
    defaultModel: "x-ai/grok-4.1-fast",
  },
  {
    id: "judge-claude",
    label: "Claude",
    apiKeyEnv: "JUDGE_B_API_KEY",
    modelEnv: "JUDGE_B_MODEL",
    defaultModel: "anthropic/claude-haiku-4.5",
  },
  {
    id: "judge-arbiter",
    label: "ChatGPT",
    apiKeyEnv: "JUDGE_C_API_KEY",
    modelEnv: "JUDGE_C_MODEL",
    defaultModel: "openai/gpt-4.1-mini",
  },
];

// ─── Panel execution ────────────────────────────────────────────────────────

/** Wrap a judge call with a hard wall-clock timeout — last line of defence if the
 *  provider's own stream timeout fails to fire (e.g. the SDK call itself hangs). */
function withHardTimeout<T>(fn: () => Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[judging] ${label} hard timeout after ${ms / 1000}s`)), ms),
    ),
  ]);
}

/**
 * Runs the 3-judge panel in two phases:
 *
 * Phase 1 — Grok (JUDGE_A) and Claude (JUDGE_B) judge independently and in parallel.
 *            Each fact-checks the full debate transcript.
 *
 * Phase 2 — GPT Arbiter (JUDGE_C) reads the full transcript AND both Phase 1 verdicts.
 *            It produces the authoritative final fact-checking analysis.
 *
 * The Arbiter's explanation and claim checks are used as the official consensus.
 * A 2/3 majority vote determines the official winner.
 */
export async function runJudgePanel(input: JudgeInput): Promise<ConsensusResult> {
  const [keyA, keyB, keyC] = JUDGE_CONFIGS.map((c) => process.env[c.apiKeyEnv] ?? "");
  const anyKey = keyA || keyB || keyC;

  // ── Phase 1: Grok + Claude in parallel ──────────────────────────────────
  const mock = new MockJudgingProvider();

  let grokVerdict: SingleJudgeVerdict;
  let claudeVerdict: SingleJudgeVerdict;

  if (!anyKey) {
    [grokVerdict, claudeVerdict] = await Promise.all([mock.judge(input), mock.judge(input)]);
  } else {
    const grokProvider = keyA
      ? new GrokJudgingProvider({ apiKey: keyA, model: process.env[JUDGE_CONFIGS[0].modelEnv] })
      : mock;

    const claudeProvider = keyB
      ? new ClaudeJudgingProvider({ apiKey: keyB, model: process.env[JUDGE_CONFIGS[1].modelEnv] })
      : mock;

    [grokVerdict, claudeVerdict] = await Promise.all([
      withHardTimeout(
        () => grokProvider.judge(input).catch((e) => { console.error("[Judge A] Failed:", e); return mock.judge(input); }),
        120_000, "Grok",
      ).catch((e) => { console.error("[Judge A] Hard timeout:", e); return mock.judge(input); }),
      withHardTimeout(
        () => claudeProvider.judge(input).catch((e) => { console.error("[Judge B] Failed:", e); return mock.judge(input); }),
        120_000, "Claude",
      ).catch((e) => { console.error("[Judge B] Hard timeout:", e); return mock.judge(input); }),
    ]);
  }

  // ── Phase 2: Arbiter reads debate + both phase-1 verdicts ───────────────
  let arbiterVerdict: SingleJudgeVerdict;

  if (!anyKey || !keyC) {
    arbiterVerdict = await mock.judge(input);
  } else {
    const arbiter = new ArbiterJudgingProvider({
      apiKey: keyC,
      model: process.env[JUDGE_CONFIGS[2].modelEnv],
    });
    arbiterVerdict = await withHardTimeout(
      () => arbiter.judgeWithPriorVerdicts(input, [
        { judgeName: "Grok", verdict: grokVerdict },
        { judgeName: "Claude", verdict: claudeVerdict },
      ]).catch((e) => {
        console.error("[Judge C] Failed:", e);
        return syntheticArbiter(grokVerdict, claudeVerdict, input);
      }),
      210_000, "Arbiter",
    ).catch((e) => {
      console.error("[Judge C] Hard timeout:", e);
      return syntheticArbiter(grokVerdict, claudeVerdict, input);
    });

    // If the Arbiter returned partial data (e.g. truncated JSON), backfill from Grok+Claude
    const p1HasChecks = grokVerdict.evidenceChecks.length > 0 || claudeVerdict.evidenceChecks.length > 0;
    if (arbiterVerdict.evidenceChecks.length === 0 && p1HasChecks) {
      const synthetic = syntheticArbiter(grokVerdict, claudeVerdict, input);
      arbiterVerdict = {
        ...arbiterVerdict,
        evidenceChecks: synthetic.evidenceChecks,
        scoresA: arbiterVerdict.scoresA ?? synthetic.scoresA,
        scoresB: arbiterVerdict.scoresB ?? synthetic.scoresB,
      };
    }
  }

  const verdicts: SingleJudgeVerdict[] = [grokVerdict, claudeVerdict, arbiterVerdict];

  // 2/3 majority vote — Arbiter casts the deciding vote if Grok and Claude split.
  const voteCount: Record<string, number> = {};
  for (const v of verdicts) {
    if (v.winnerId) voteCount[v.winnerId] = (voteCount[v.winnerId] ?? 0) + 1;
  }

  const voteA = voteCount[input.debaterA.id] ?? 0;
  const voteB = voteCount[input.debaterB.id] ?? 0;

  let majorityWinnerId: string;
  let voteScore: string;

  if (voteA !== voteB) {
    majorityWinnerId = voteA > voteB ? input.debaterA.id : input.debaterB.id;
    const winnerVotes = Math.max(voteA, voteB);
    const loserVotes = Math.min(voteA, voteB);
    voteScore = `${winnerVotes}\u2013${loserVotes}`;
  } else {
    majorityWinnerId = arbiterVerdict.winnerId ?? input.debaterA.id;
    voteScore = "tiebreak";
  }

  const majorityWinnerName =
    majorityWinnerId === input.debaterA.id ? input.debaterA.username : input.debaterB.username;

  const majorityExplanation =
    voteScore === "tiebreak"
      ? `Judges split 1\u20131; ChatGPT cast the deciding vote for ${majorityWinnerName}. ${arbiterVerdict.explanation}`
      : `${majorityWinnerName} wins by ${voteScore} judge vote.\n\n${arbiterVerdict.explanation}`;

  return {
    winnerId: majorityWinnerId ?? null,
    explanation: majorityExplanation,
    privateFeedbackA: arbiterVerdict.privateFeedbackA,
    privateFeedbackB: arbiterVerdict.privateFeedbackB,
    evidenceChecks: arbiterVerdict.evidenceChecks ?? [],
    judgeVerdicts: verdicts,
    judgeCount: 3,
    scoresA: arbiterVerdict.scoresA,
    scoresB: arbiterVerdict.scoresB,
    biggestMistakeA: arbiterVerdict.biggestMistakeA,
    biggestAchievementA: arbiterVerdict.biggestAchievementA,
    biggestMistakeB: arbiterVerdict.biggestMistakeB,
    biggestAchievementB: arbiterVerdict.biggestAchievementB,
  };
}
