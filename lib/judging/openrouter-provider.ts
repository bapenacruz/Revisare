import { OpenRouter } from "@openrouter/sdk";
import type { DebaterScores, EvidenceCheck, IJudgingProvider, JudgeInput, SingleJudgeVerdict } from "./types";
import { db } from "@/lib/db";

// ─── Master prompt ─────────────────────────────────────────────────────────────
//
// A single DB record (type: "master_judging_prompt") drives ALL judge logic.
// The admin edits this via /admin/judge-prompts.
// Only the transcript, debater context, and JSON schema are auto-injected.

export const DEFAULT_MASTER_PROMPT = `You are an expert debate judge evaluating a structured eight-turn debate (opening x2, crossfire x2, rebuttal x2, summary x2) on the platform Revisare. Deliver an impartial, evidence-based verdict.

CRITICAL OUTPUT RULES
- Return ONLY valid JSON — no markdown fences, no text before or after the JSON
- Use only plain ASCII characters
- Always use the exact debater usernames as provided
- No ties — always determine one winner

FOUR-PHASE EVALUATION FRAMEWORK

Evaluate EACH phase separately before reaching an overall verdict:

1. OPENING CONSTRUCTIVE — Did each debater establish a clear, well-evidenced position?
   Was the core argument grounded in facts/reasoning or just assertions?

2. CROSSFIRE — Direct Q&A challenge phase. Evaluate:
   - Did the debater answer their opponent's questions directly and honestly?
   - Did they dodge, deflect, or give non-answers? (penalise rebuttal_quality heavily)
   - Did they press effectively with follow-up questions or challenges?
   Note: crossfire evasion is a significant procedural failure.

3. REBUTTAL — Did the debater directly address the opponent's opening and crossfire arguments?
   Every significant claim from the opponent should have been engaged.
   Credit for direct refutation with counter-evidence. Penalise for ignoring major opponent arguments.

4. CLOSING SUMMARY — Did the debater crystallise the debate effectively?
   No new arguments should be introduced here. Credit for identifying key clash points.

SCORING RULES
- Score 0-10 on all six dimensions
- Weights: factuality=35%, evidence_quality=25%, argument_strength=15%, rebuttal_quality=20%, clarity=3%, persuasiveness=2%
- DOMINANCE RULE: if factuality < 5, cap final_score at 6.0; if factuality < 3, cap at 3.0 (automatic loss)
- Rebuttal_quality includes crossfire engagement — dodging questions is a direct penalty
- No ties — the winner is the debater whose overall case was more truthful, better-evidenced, and more directly responsive

EVIDENCE-WEIGHTED TOPICS (science, economics, law, history, technology):
- Factuality (35%) measures whether claims are actually true. Aggressively fact-check statistics, historical claims, scientific findings, legal facts.
- Evidence_quality (25%) measures whether claims were backed by real sources. Vague references score low.
- A persuasive-sounding but factually false argument MUST score low on factuality regardless of rhetorical skill.

REASONING-WEIGHTED TOPICS (philosophy, ethics, society, values, culture, religion):
- Factuality (35%) measures REASONING COHERENCE: internal consistency, logical validity, whether value assumptions are clearly stated.
- Evidence_quality (25%) measures ARGUMENTATIVE STRENGTH: quality of philosophical reasoning, thought experiments, precedent-based evidence.
- Do NOT pretend to determine objective moral or philosophical truth. Evaluate argument strength and consistency.
- You CANNOT rule a normative claim "incorrect" — use "unsupported" or "disputed" instead.

ANTI-BIAS PRINCIPLES (mandatory — override any conflicting instinct):

RULE 1 — ALTERNATIVES ARE NOT REQUIRED:
A debater who argues that an opposing proposal is unfair, dangerous, unconstitutional, or ineffective does NOT
need to present a complete alternative to win that argument. Criticising and replacing are two separate tasks.

RULE 2 — FAILURE ASYMMETRY:
"The opponent failed to fully solve the problem" does NOT automatically validate the other side's proposal.
Both sides must independently justify their own position. Award wins on argument strength, never by default.

RULE 3 — NO FRAMEWORK PREFERENCE:
Do NOT favour utilitarian reasoning, practicality, or economic efficiency over rule-of-law, fairness,
constitutional, moral, rights-based, or deterrence-based arguments without cause. Principle-based
arguments are legitimate winning arguments even without implementation details.

RULE 4 — EVIDENCE SCOPE — USE CORRECT LABELS:
  - "Not cited in this debate" → use verdict: unsupported_in_round
  - "No real-world evidence exists" → use verdict: unsupported_generally
Never imply a claim is generally false simply because the debater failed to cite a source in the round.

RULE 5 — REWARD DIRECT ENGAGEMENT:
Heavily reward debaters who directly address opponent arguments, expose contradictions, force tradeoffs.
Heavily penalise dodging, ignoring, strawmanning, or deflecting opponent arguments.

RULE 6 — BIDIRECTIONAL JUSTIFICATION:
Do NOT interpret "their proposal has flaws" as proof that the other side is correct.
Both sides must affirmatively justify their own position.`;

async function getMasterPrompt(): Promise<string> {
  try {
    const record = await db.judgePrompt.findFirst({
      where: { type: "master_judging_prompt", isActive: true },
    });
    if (record?.prompt) return record.prompt;
  } catch (error) {
    console.error("Error fetching master judging prompt:", error);
  }
  return DEFAULT_MASTER_PROMPT;
}

function buildSystemPrompt(masterPrompt: string, input: JudgeInput): string {
  const contextBlock =
    `=== DEBATE CONTEXT ===\n` +
    `Motion: "${input.motion}"\n` +
    `Category: ${input.categorySlug ?? "general"}\n` +
    `Debater A (Proposition): ${input.debaterA.username}\n` +
    `Debater B (Opposition): ${input.debaterB.username}`;
  return (
    masterPrompt +
    "\n\n" +
    contextBlock +
    "\n\n" +
    "=== OUTPUT FORMAT ===\n" +
    "Respond with ONLY valid JSON — no markdown fences, no commentary — matching this schema exactly:\n" +
    buildVerdictSchema(input)
  );
}

function buildVerdictSchema(input: JudgeInput, summaryInstruction?: string): string {
  const a = input.debaterA.username;
  const b = input.debaterB.username;
  const summaryRule = summaryInstruction
    ? `\nMANDATORY RULE FOR public_result.summary — you MUST follow this exactly:\n${summaryInstruction}\n`
    : "";
  return `${summaryRule}{
  "winner_username": "<${a} or ${b}>",
  "public_result": {
    "winner_username": "<${a} or ${b}>",
    "summary": "<3-5 concise sentences: state the winner, cite the decisive phase/argument, and briefly note the most critical unanswered argument that sealed the outcome>"
  },
  "private_assessment": {
    "decision_summary": "<1-2 sentences: why the winner won, citing the single most decisive factor>",
    "key_analysis": {
      "strongest_rebuttal": "<the single most effective rebuttal made by either debater — quote briefly and note why it landed>",
      "critical_unanswered_argument": "<the most important argument that went unanswered by the losing side — explain its impact on the outcome>",
      "crossfire_assessment": "<1 sentence each on how each debater performed during the crossfire phase: did they answer directly, dodge, press effectively?>"
    },
    "key_claim_checks": [
      {
        "username": "<${a} or ${b}>",
        "claim": "<specific factual or evidential claim from the transcript>",
        "verdict": "<correct|mostly_correct|misleading|disputed|context_dependent|unsupported_in_round|unsupported_generally|incorrect>",
        "reason": "<short explanation — for unsupported_in_round note evidence was absent in this debate, for unsupported_generally note the claim lacks real-world support>",
        "source": "<real source name or credible category if uncertain>"
      }
    ],
    "scores": {
      "${a}": {
        "factuality": <0-10 integer>,
        "evidence_quality": <0-10 integer>,
        "argument_strength": <0-10 integer>,
        "rebuttal_quality": <0-10 integer>,
        "clarity": <0-10 integer>,
        "persuasiveness": <0-10 integer>,
        "final_score": <weighted score with dominance rules applied, rounded to 1 decimal>
      },
      "${b}": {
        "factuality": <0-10 integer>,
        "evidence_quality": <0-10 integer>,
        "argument_strength": <0-10 integer>,
        "rebuttal_quality": <0-10 integer>,
        "clarity": <0-10 integer>,
        "persuasiveness": <0-10 integer>,
        "final_score": <weighted score with dominance rules applied, rounded to 1 decimal>
      }
    },
    "winner_reason": "<1-2 sentences: decisive factor in winner determination>"
  }
}

Requirements:
- Include 3-8 key_claim_checks covering the most important and impactful assertions from both debaters
- Prioritise claims made in opening and rebuttal; note if a crossfire question went unanswered
- Use exact usernames ${a} and ${b}
- Apply dominance rules: if factuality < 5 cap final_score at 6.0; if factuality < 3 cap at 3.0 (automatic loss)
- Choose winner based on the full four-phase evaluation, not just factual score`;
}

const PHASE_LABEL: Record<string, string> = {
  opening:   "OPENING CONSTRUCTIVE",
  crossfire: "CROSSFIRE",
  rebuttal:  "REBUTTAL",
  summary:   "CLOSING SUMMARY",
  closing:   "CLOSING ARGUMENT", // legacy
};

function buildTranscriptText(input: JudgeInput): string {
  const prop = input.coinFlipWinnerId === input.debaterA.id ? input.debaterA : input.debaterB;
  const opp  = prop.id === input.debaterA.id ? input.debaterB : input.debaterA;

  const transcript = input.turns
    .map((t) => {
      const debater = t.userId === input.debaterA.id ? input.debaterA : input.debaterB;
      const side    = debater.id === prop.id ? "PROPOSITION" : "OPPOSITION";
      const phase   = PHASE_LABEL[t.roundName] ?? t.roundName.toUpperCase();
      return `[${phase} | ${debater.username} | ${side}]\n${t.content}`;
    })
    .join("\n\n---\n\n");

  return `MOTION: "${input.motion}"
FORMAT: ${input.format}${input.categorySlug ? ` | CATEGORY: ${input.categorySlug}` : ""}
PROPOSITION: ${prop.username}
OPPOSITION:  ${opp.username}
DEBATER A id="${input.debaterA.id}": ${input.debaterA.username}
DEBATER B id="${input.debaterB.id}": ${input.debaterB.username}

DEBATE STRUCTURE (each speaker gets one turn per phase):
  Phase 1 — Opening Constructive (3 min): Establish positions with evidence
  Phase 2 — Crossfire (1.5 min):         Direct Q&A challenge between debaters
  Phase 3 — Rebuttal (2 min):            Attack and defend; engage all major claims
  Phase 4 — Closing Summary (1 min):     Crystallise the debate; no new arguments

FULL DEBATE TRANSCRIPT:
${transcript}`;
}

/** Strip markdown code fences that some models wrap around JSON */
function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

/**
 * Escape literal newlines / carriage-returns that appear inside JSON string
 * values. Some models emit real \n characters inside quoted strings instead of
 * the JSON-escaped \\n sequence, which causes JSON.parse to fail.
 */
function sanitizeLiteralNewlines(s: string): string {
  let inString = false;
  let esc = false;
  let result = "";
  for (const ch of s) {
    if (esc) { result += ch; esc = false; continue; }
    if (ch === "\\" && inString) { result += ch; esc = true; continue; }
    if (ch === '"') { result += ch; inString = !inString; continue; }
    if (inString && ch === "\n") { result += "\\n"; continue; }
    if (inString && ch === "\r") { result += "\\r"; continue; }
    result += ch;
  }
  return result;
}

function tryParseJson(raw: string): Record<string, unknown> {
  const cleaned = stripJsonFences(raw);
  // Attempt 1: standard parse
  try { return JSON.parse(cleaned) as Record<string, unknown>; } catch {}
  // Attempt 2: sanitize literal newlines inside strings
  const sanitized = sanitizeLiteralNewlines(cleaned);
  try { return JSON.parse(sanitized) as Record<string, unknown>; } catch {}
  // Attempt 3: remove trailing commas before } or ]
  const noTrailing = sanitized.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(noTrailing) as Record<string, unknown>; } catch {}
  // Attempt 4: regex-extract basic fields for new format fallback
  const winnerUsername = cleaned.match(/"winner_username"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  const summary = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\n/g, "\n") ?? "";
  if (winnerUsername) {
    return { 
      winner_username: winnerUsername, 
      public_result: { winner_username: winnerUsername, summary },
      private_assessment: { key_claim_checks: [] }
    };
  }
  throw new Error(`Failed to parse judge JSON after all attempts. Raw (first 400): ${raw.slice(0, 400)}`);
}

function parseVerdict(raw: string, input: JudgeInput): SingleJudgeVerdict {
  const parsed = tryParseJson(raw);

  // Map winner_username to winnerId
  const publicResult = parsed.public_result as Record<string, unknown> | undefined;
  const winnerUsername = parsed.winner_username ?? (publicResult?.winner_username as string | undefined);
  const winnerId: string | null = 
    winnerUsername === input.debaterA.username ? input.debaterA.id :
    winnerUsername === input.debaterB.username ? input.debaterB.id :
    input.debaterA.id; // fallback

  // Extract summary from new format
  const explanation = String((publicResult?.summary as string) ?? parsed.summary ?? "");

  // Extract evidence checks — support both old key_claim_checks and legacy format
  const VALID_VERDICTS = new Set([
    "correct", "mostly_correct", "misleading", "disputed", "context_dependent",
    "unsupported_in_round", "unsupported_generally", "incorrect", "unsupported",
  ]);
  const privateAssessment = parsed.private_assessment as Record<string, unknown> | undefined;
  const claimChecksRaw = Array.isArray(privateAssessment?.key_claim_checks)
    ? privateAssessment.key_claim_checks as Array<Record<string, unknown>>
    : [];
  const evidenceChecks: EvidenceCheck[] = claimChecksRaw
    .filter((e) => e && typeof e.claim === "string" && typeof e.verdict === "string")
    .map((e) => ({
      debater: String(e.username ?? ""),
      claim: String(e.claim ?? ""),
      verdict: (VALID_VERDICTS.has(String(e.verdict)) ? e.verdict : "unsupported") as EvidenceCheck["verdict"],
      explanation: String(e.reason ?? ""),
      source: typeof e.source === "string" && e.source ? e.source : undefined,
      importance: undefined,
    }));

  // Extract scores from new nested format
  const scores = privateAssessment?.scores as Record<string, unknown> | undefined;
  const scoresA = parseScoresFromNew(scores?.[input.debaterA.username]);
  const scoresB = parseScoresFromNew(scores?.[input.debaterB.username]);

  // Generate private feedback for both debaters
  const winnerReason = String(privateAssessment?.winner_reason ?? "");
  const scoresObjA = scores?.[input.debaterA.username] as Record<string, unknown> | undefined;
  const scoresObjB = scores?.[input.debaterB.username] as Record<string, unknown> | undefined;
  const isWinnerA = winnerUsername === input.debaterA.username;
  const privateFeedbackA = [
    isWinnerA ? `You won this debate. ${winnerReason}` : `You lost this debate. ${winnerReason}`,
    scoresObjA?.improvement ? `Improvement tip: ${scoresObjA.improvement}` : "",
  ].filter(Boolean).join("\n\n");
  const privateFeedbackB = [
    !isWinnerA ? `You won this debate. ${winnerReason}` : `You lost this debate. ${winnerReason}`,
    scoresObjB?.improvement ? `Improvement tip: ${scoresObjB.improvement}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    winnerId,
    explanation,
    privateFeedbackA,
    privateFeedbackB,
    evidenceChecks,
    scoresA,
    scoresB,
    biggestMistakeA: undefined,
    biggestAchievementA: undefined,
    biggestMistakeB: undefined,
    biggestAchievementB: undefined,
    improvementA: undefined,
    improvementB: undefined,
  };
}

function parseScoresFromNew(raw: unknown): DebaterScores | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const n = (k: string, fallback = 5): number => {
    const v = r[k];
    return typeof v === "number" ? Math.max(0, Math.min(10, v)) : fallback;
  };
  const factuality = n("factuality");
  const evidence_quality = n("evidence_quality");
  const argument_strength = n("argument_strength");
  const rebuttal_quality = n("rebuttal_quality");
  const clarity = n("clarity");
  const persuasiveness = n("persuasiveness");
  
  // Compute server-side — don't trust model's arithmetic
  let final_score =
    factuality * 0.35 +
    evidence_quality * 0.25 +
    argument_strength * 0.15 +
    rebuttal_quality * 0.15 +
    clarity * 0.05 +
    persuasiveness * 0.05;
  if (factuality < 3) final_score = Math.min(final_score, 3);
  else if (factuality < 5) final_score = Math.min(final_score, 6);
  
  return {
    factuality,
    evidence_quality,
    argument_strength,
    rebuttal_quality,
    clarity,
    persuasiveness,
    final_score: Math.round(final_score * 10) / 10,
  };
}

/** Collect all chunks from a streaming chat.send() response into one string.
 * Uses Promise.race so the timeout fires even if no chunks ever arrive. */
async function collectStream(
  stream: AsyncIterable<{ choices: Array<{ delta: { content?: string | null } }> }>,
  timeoutMs = 90_000,
): Promise<string> {
  let text = "";

  const drain = async (): Promise<string> => {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) text += content;
    }
    return text.trim();
  };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Stream timed out after ${Math.round(timeoutMs / 1000)}s`)),
      timeoutMs,
    ),
  );

  return Promise.race([drain(), timeout]);
}

/** Retry a function up to `attempts` times with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 2, delayMs = 4000 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        console.warn(
          `[judging] attempt ${i + 1}/${attempts} failed (retrying in ${delayMs}ms):`,
          err instanceof Error ? err.message : err,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * 2, 30_000);
      }
    }
  }
  throw lastErr;
}

// ─── Judge A: Grok ─────────────────────────────────────────────────────────────

async function buildGrokSystem(input: JudgeInput): Promise<string> {
  return buildSystemPrompt(await getMasterPrompt(), input);
}

export class GrokJudgingProvider implements IJudgingProvider {
  readonly name = "Grok";
  private readonly client: OpenRouter;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new OpenRouter({
      apiKey: options.apiKey,
      httpReferer: "https://arguably.app",
      appTitle: "Arguably Debate Platform",
    });
    this.model = options.model ?? "x-ai/grok-4.1-fast";
  }

  async judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    return withRetry(() => this._judge(input));
  }

  private async _judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    const systemContent = await buildGrokSystem(input);
    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.3,
        maxTokens: 4000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content: buildTranscriptText(input) + "\n\nFact-check this debate and provide your verdict JSON.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream, 90_000);
    if (!raw) throw new Error("Empty response from Grok judge");
    return parseVerdict(raw, input);
  }
}

// ─── Judge B: Claude ───────────────────────────────────────────────────────────

async function buildClaudeSystem(input: JudgeInput): Promise<string> {
  return buildSystemPrompt(await getMasterPrompt(), input);
}

export class ClaudeJudgingProvider implements IJudgingProvider {
  readonly name = "Claude";
  private readonly client: OpenRouter;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new OpenRouter({
      apiKey: options.apiKey,
      httpReferer: "https://arguably.app",
      appTitle: "Arguably Debate Platform",
    });
    this.model = options.model ?? "anthropic/claude-haiku-4.5";
  }

  async judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    return withRetry(() => this._judge(input));
  }

  private async _judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    const systemContent = await buildClaudeSystem(input);
    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.3,
        maxTokens: 4000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content: buildTranscriptText(input) + "\n\nFact-check this debate and provide your verdict JSON.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream, 90_000);
    if (!raw) throw new Error("Empty response from Claude judge");
    return parseVerdict(raw, input);
  }
}

// ─── Judge C: GPT — The Arbiter ───────────────────────────────────────────────

async function buildArbiterSystem(input: JudgeInput): Promise<string> {
  return buildSystemPrompt(await getMasterPrompt(), input);
}

export class ArbiterJudgingProvider implements IJudgingProvider {
  readonly name = "Arbiter (GPT)";
  private readonly client: OpenRouter;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new OpenRouter({
      apiKey: options.apiKey,
      httpReferer: "https://arguably.app",
      appTitle: "Arguably Debate Platform",
    });
    this.model = options.model ?? "openai/gpt-4.1-mini";
  }

  async judgeWithPriorVerdicts(
    input: JudgeInput,
    priorVerdicts: Array<{ judgeName: string; verdict: SingleJudgeVerdict }>,
  ): Promise<SingleJudgeVerdict> {
    return withRetry(() => this._judgeWithPriorVerdicts(input, priorVerdicts), { attempts: 2, delayMs: 5000 });
  }

  private async _judgeWithPriorVerdicts(
    input: JudgeInput,
    priorVerdicts: Array<{ judgeName: string; verdict: SingleJudgeVerdict }>,
  ): Promise<SingleJudgeVerdict> {
    const transcriptText = buildTranscriptText(input);

    const priorSection =
      priorVerdicts.length > 0
        ? "\n\n" +
          "=== PEER JUDGE VERDICTS (for arbitration use only) ===\n" +
          "You are the final Arbitrator. You have read the full debate above AND the two peer verdicts below.\n" +
          "Your role is to act as a genuine meta-judge, NOT to mechanically average their scores.\n\n" +
          "ARBITRATION PROCESS:\n" +
          "1. AGREEMENT: Where Grok and Claude agree on a winner, this raises confidence. Note where they agree.\n" +
          "2. DISAGREEMENT: Where they split, examine each verdict for flaws — did one judge overlook a key claim?\n" +
          "   Did one judge fall for a plausible-sounding but false assertion? Did one penalise or reward unfairly?\n" +
          "3. HALLUCINATION CHECK: Flag any claim checks from peer judges that seem fabricated, unverifiable, or\n" +
          "   inconsistent with the actual transcript. Ignore or discount those findings.\n" +
          "4. SCORING ANOMALIES: If peer scores for the same debater differ by more than 2 points on any dimension,\n" +
          "   investigate why. Apply the more accurate score, not the average.\n" +
          "5. OVERLOOKED REBUTTALS: Check if any significant argument in the transcript was missed by both peer judges.\n" +
          "   Incorporate those findings into your verdict.\n" +
          "6. FINAL DETERMINATION: Issue your own independent winner determination supported by your analysis.\n" +
          "   If peer judges agree, ordinarily follow that consensus — but you may override if their reasoning is flawed.\n\n" +
          "7. IDEOLOGICAL CONVERGENCE CHECK: Examine whether both peer judges share a systematic framing bias:\n" +
          "   - Did both judges implicitly favour utilitarian or practical arguments over rights-based/principle arguments?\n" +
          "   - Did both reward 'having a solution' over 'proving the solution is justified or valid'?\n" +
          "   - Did both penalise moral, constitutional, or deterrence-based arguments unfairly?\n" +
          "   - Did both treat empirical uncertainty inconsistently between the two debaters?\n" +
          "   If ideological convergence is detected, explicitly note it and correct for it in your determination.\n\n" +
          "8. POTENTIAL BIAS REVIEW: Before finalising your verdict, confirm:\n" +
          "   - You have NOT penalised a debater for failing to present a complete alternative system.\n" +
          "   - You have NOT treated 'opponent\'s solution is imperfect' as automatic validation of the other side.\n" +
          "   - You have used 'unsupported_in_round' (not cited here) vs 'unsupported_generally' (no real evidence) correctly.\n" +
          "   - You have given equal weight to rights-based and principle-based arguments vs practicality arguments.\n\n" +
          priorVerdicts
            .map(({ judgeName, verdict }) => {
              const winnerName =
                verdict.winnerId === input.debaterA.id
                  ? input.debaterA.username
                  : verdict.winnerId === input.debaterB.id
                    ? input.debaterB.username
                    : "Tie";
              const claimSummary = verdict.evidenceChecks
                .slice(0, 6)
                .map((e) => `    • ${e.debater} claim \"${e.claim.slice(0, 70)}...\" -> ${e.verdict}: ${e.explanation.slice(0, 80)}`)
                .join("\n");
              const scoresA = verdict.scoresA ? `factuality=${verdict.scoresA.factuality} evidence=${verdict.scoresA.evidence_quality} rebuttal=${verdict.scoresA.rebuttal_quality} final=${verdict.scoresA.final_score}` : "(no scores)";
              const scoresB = verdict.scoresB ? `factuality=${verdict.scoresB.factuality} evidence=${verdict.scoresB.evidence_quality} rebuttal=${verdict.scoresB.rebuttal_quality} final=${verdict.scoresB.final_score}` : "(no scores)";
              return (
                `--- PEER VERDICT: ${judgeName} ---\n` +
                `Winner: ${winnerName}\n` +
                `Analysis: ${verdict.explanation.slice(0, 500)}\n` +
                `Scores ${input.debaterA.username}: ${scoresA}\n` +
                `Scores ${input.debaterB.username}: ${scoresB}\n` +
                `Key claim findings:\n${claimSummary || "    (none)"}`
              );
            })
            .join("\n\n")
        : "";

    const systemContent = await buildArbiterSystem(input);
    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.25,
        maxTokens: 8000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content:
              transcriptText +
              priorSection +
              "\n\nNow deliver your authoritative final arbitration verdict JSON. Apply your meta-judge analysis of the peer verdicts above and issue your independent determination.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream, 180_000); // 3 min for Arbiter
    if (!raw) throw new Error("Empty response from Arbiter judge");
    return parseVerdict(raw, input);
  }

  async judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    return this.judgeWithPriorVerdicts(input, []);
  }
}

// ─── Feedback-only regeneration ──────────────────────────────────────────────

const FEEDBACK_BLOCK_TEMPLATE = (name: string) =>
  `factuality: <integer 0-10>\nevidence_quality: <integer 0-10>\nargument_strength: <integer 0-10>\nrebuttal_quality: <integer 0-10>\nclarity: <integer 0-10>\npersuasiveness: <integer 0-10>\n\nMajor Strength: <exactly one sentence — ${name}'s single most effective argument or evidence use>\nMajor Weakness: <exactly one sentence — ${name}'s biggest factual or logical error>\n\nImprovement: <exactly one short actionable sentence — the most important thing ${name} should improve>`;

/**
 * Generates ONLY the structured private feedback for both debaters.
 * Does not re-run fact-checking or scoring; uses the debate transcript directly.
 * Returns plain-text blocks in the exact required format.
 */
export async function generateFeedbackOnly(
  input: JudgeInput,
  options: { apiKey: string; model?: string },
): Promise<{ feedbackA: string; feedbackB: string }> {
  const client = new OpenRouter({
    apiKey: options.apiKey,
    httpReferer: "https://arguably.app",
    appTitle: "Arguably Debate Platform",
  });
  const model = options.model ?? "openai/gpt-4.1-mini";
  const a = input.debaterA.username;
  const b = input.debaterB.username;

  const extraInstruction = ""; // admin master prompt handles all judging instructions

  const systemPrompt = `You are an expert debate judge providing private performance feedback.

HARD RULES:
- Output MUST be valid JSON with exactly two keys: "feedbackA" and "feedbackB"
- Each value MUST follow the EXACT format below — no extra text, no emojis, no unicode
- Scores 0-10 where factuality is the most important dimension
- If core claims are false, factuality must be 0-4 and other scores must reflect this
- Major Strength and Major Weakness must be EXACTLY ONE sentence each
- Improvement must be EXACTLY ONE short actionable sentence

REQUIRED FORMAT for each feedback value (plain text, newlines as \\n):
${FEEDBACK_BLOCK_TEMPLATE("<debater username>")}
${extraInstruction ? `\nADDITIONAL INSTRUCTION for generating feedback:\n${extraInstruction}` : ""}

Output only valid JSON — no markdown fences, no commentary.`;

  const userPrompt = `${buildTranscriptText(input)}

Now produce private feedback for both debaters.

JSON schema:
{
  "feedbackA": "${FEEDBACK_BLOCK_TEMPLATE(a).replace(/\n/g, "\\n")}",
  "feedbackB": "${FEEDBACK_BLOCK_TEMPLATE(b).replace(/\n/g, "\\n")}"
}`;

  const doRequest = async () => {
    const stream = await client.chat.send({
      chatRequest: {
        model,
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      },
    });
    return collectStream(stream, 90_000);
  };

  const raw = await withRetry(doRequest, { attempts: 4, delayMs: 3000 });
  if (!raw) throw new Error("Empty response from feedback generator");

  const parsed = tryParseJson(raw);
  const feedbackA = typeof parsed.feedbackA === "string" ? parsed.feedbackA.trim() : "";
  const feedbackB = typeof parsed.feedbackB === "string" ? parsed.feedbackB.trim() : "";
  if (!feedbackA || !feedbackB) throw new Error("Missing feedbackA or feedbackB in response");
  return { feedbackA, feedbackB };
}

