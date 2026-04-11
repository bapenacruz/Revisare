export interface JudgeInput {
  motion: string;
  format: string;
  debaterA: { id: string; username: string };
  debaterB: { id: string; username: string };
  /** Who won the coin flip (goes first = Proposition) */
  coinFlipWinnerId: string;
  turns: Array<{ userId: string; roundName: string; content: string }>;
}

/**
 * Verdict on a specific factual claim made during the debate.
 *
 * "correct"     — confirmed by credible, verifiable evidence
 * "incorrect"   — directly contradicted by credible evidence
 * "misleading"  — partially true but deceptively framed, missing crucial context, or significantly exaggerated
 * "disputed"    — actively contested among credible sources; no clear consensus exists
 * "unsupported" — asserted without adequate proof; unverifiable or too speculative to evaluate
 */
export type EvidenceVerdict = "correct" | "incorrect" | "misleading" | "disputed" | "unsupported";

export interface EvidenceCheck {
  /** Username of the debater who made the claim */
  debater: string;
  /** The specific factual claim, quoted or closely paraphrased */
  claim: string;
  verdict: EvidenceVerdict;
  /** Why the claim is true or false — cite specific statistics, studies, or evidence */
  explanation: string;
  /** Specific citation, e.g. "IPCC AR6 2021" or "BLS Employment Situation Jan 2025" */
  source?: string;
  /** How central is this claim's truthfulness to the debater's overall case */
  importance?: "central" | "supporting" | "peripheral";
}

/**
 * Per-debater scoring dimensions produced by each judge.
 * Weights: factuality 35%, evidence_quality 25%, argument_strength 15%,
 *          rebuttal_quality 15%, clarity 5%, persuasiveness 5%.
 * Factuality dominance: if factuality < 5 → final_score capped at 6;
 *                       if factuality < 3 → final_score capped at 3 (auto-loss).
 */
export interface DebaterScores {
  factuality: number;
  evidence_quality: number;
  argument_strength: number;
  rebuttal_quality: number;
  clarity: number;
  persuasiveness: number;
  final_score: number;
}

export interface SingleJudgeVerdict {
  winnerId: string | null;
  /** 2–4 sentence verdict summary (sharp fact-checker style) */
  explanation: string;
  privateFeedbackA: string;
  privateFeedbackB: string;
  evidenceChecks: EvidenceCheck[];
  scoresA?: DebaterScores;
  scoresB?: DebaterScores;
  /** Single biggest factual/logical mistake made by debater A */
  biggestMistakeA?: string;
  /** Single most impressive moment or argument by debater A */
  biggestAchievementA?: string;
  /** Single biggest factual/logical mistake made by debater B */
  biggestMistakeB?: string;
  /** Single most impressive moment or argument by debater B */
  biggestAchievementB?: string;
  /** Single actionable improvement tip for debater A */
  improvementA?: string;
  /** Single actionable improvement tip for debater B */
  improvementB?: string;
}

export interface ConsensusResult {
  winnerId: string | null;
  /** 2–4 sentence verdict summary (sharp fact-checker style) */
  explanation: string;
  privateFeedbackA: string;
  privateFeedbackB: string;
  evidenceChecks: EvidenceCheck[];
  judgeVerdicts: SingleJudgeVerdict[];
  judgeCount: number;
  scoresA?: DebaterScores;
  scoresB?: DebaterScores;
  biggestMistakeA?: string;
  biggestAchievementA?: string;
  biggestMistakeB?: string;
  biggestAchievementB?: string;
  improvementA?: string;
  improvementB?: string;
}

export interface IJudgingProvider {
  readonly name: string;
  judge(input: JudgeInput): Promise<SingleJudgeVerdict>;
}
