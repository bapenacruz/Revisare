import { OpenRouter } from "@openrouter/sdk";
import type { DebaterScores, EvidenceCheck, IJudgingProvider, JudgeInput, SingleJudgeVerdict } from "./types";

function buildVerdictSchema(input: JudgeInput): string {
  const a = input.debaterA.username;
  const b = input.debaterB.username;
  const scoreBlock = (name: string) => `"${name}_scores": {
    "factuality": <0–10. MOST IMPORTANT. 0=entirely false claims, 10=every major claim verified by real evidence>,
    "evidence_quality": <0–10. quality, specificity, and credibility of evidence cited>,
    "argument_strength": <0–10. logical structure, internal consistency, and relevance to the motion>,
    "rebuttal_quality": <0–10. how effectively they addressed the opponent's specific claims>,
    "clarity": <0–10. how clearly they expressed and organised their position>,
    "persuasiveness": <0–10. overall persuasive impact on a neutral observer>,
    "final_score": <weighted score: factuality×0.35 + evidence_quality×0.25 + argument_strength×0.15 + rebuttal_quality×0.15 + clarity×0.05 + persuasiveness×0.05. RULE: if factuality<5 cap at 6.0; if factuality<3 cap at 3.0. Round to 1 decimal.>
  }`;
  return `{
  "winnerId": "<${input.debaterA.id} or ${input.debaterB.id} — pick the debater with the higher final_score; ties go to the debater with higher factuality>",
  "summary": "<3–5 sentences. Sharp fact-checker style — no fluff. Identify the KEY claims that determined the outcome, state which were unsupported or incorrect, reference evidence by name (e.g. 'Pew Research', 'BLS data', 'IPCC AR6'), and explain why that decided the winner. Use the debaters' exact usernames '${a}' and '${b}' — NEVER 'Debater A', 'Debater B', positional labels, or floating assertions.>",
  "privateFeedbackA": "<2–3 sentence coaching note to ${a}. Reference a specific claim they made. State the factual error or gap and what to do differently.>",
  "privateFeedbackB": "<same for ${b}>",
  "biggestMistakeA": "<The single biggest factual or logical error ${a} made — be specific; name the claim and why it hurt their case.>",
  "biggestAchievementA": "<The single most effective argument or moment by ${a} — be specific about what made it strong.>",
  "biggestMistakeB": "<The single biggest factual or logical error ${b} made — be specific; name the claim and why it hurt their case.>",
  "biggestAchievementB": "<The single most effective argument or moment by ${b} — be specific about what made it strong.>",
  ${scoreBlock("debaterA")},
  ${scoreBlock("debaterB")},
  "evidenceChecks": [
    {
      "debater": "<exact username '${a}' or '${b}'>",
      "claim": "<specific factual claim, quoted or closely paraphrased from the transcript>",
      "verdict": "<correct|incorrect|misleading|disputed|unsupported>",
      "explanation": "<why — cite specific statistics, studies, laws, or verified data. Say 'no clear consensus' rather than inventing a source.>",
      "source": "<specific citation: e.g. 'IPCC AR6 2021', 'BLS Employment Situation Feb 2025', 'WHO Global TB Report 2023'>",
      "importance": "<central|supporting|peripheral>"
    }
  ]
}

Requirements:
- 5–10 total claim checks; at least 2 per debater covering their most important assertions
- importance="central" means the debater's case meaningfully weakens if this claim is false
- Do NOT invent sources. If no specific source, write a credible category (e.g. "established climate science consensus")
- Verdict: correct=confirmed; incorrect=contradicted; misleading=partially true but exaggerated/missing key context; disputed=credible experts genuinely disagree; unsupported=asserted without adequate proof`;
}

function buildTranscriptText(input: JudgeInput): string {
  const prop = input.coinFlipWinnerId === input.debaterA.id ? input.debaterA : input.debaterB;
  const opp = prop.id === input.debaterA.id ? input.debaterB : input.debaterA;

  const transcript = input.turns
    .map((t) => {
      const debater = t.userId === input.debaterA.id ? input.debaterA : input.debaterB;
      const side = debater.id === prop.id ? "PROPOSITION" : "OPPOSITION";
      return `[${t.roundName.toUpperCase()} · ${debater.username} · ${side}]\n${t.content}`;
    })
    .join("\n\n---\n\n");

  return `MOTION: "${input.motion}"
FORMAT: ${input.format}
DEBATER A id="${input.debaterA.id}": ${input.debaterA.username} (${input.debaterA.id === prop.id ? "Proposition" : "Opposition"})
DEBATER B id="${input.debaterB.id}": ${input.debaterB.username} (${input.debaterB.id === opp.id ? "Opposition" : "Proposition"})

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
  // Attempt 4: regex-extract the scalar fields only, discard evidenceChecks
  const winnerId = cleaned.match(/"winnerId"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  const explanation = cleaned.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\n/g, "\n") ?? "";
  if (winnerId) {
    return { winnerId, explanation,
      privateFeedbackA: cleaned.match(/"privateFeedbackA"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\n/g, "\n") ?? "",
      privateFeedbackB: cleaned.match(/"privateFeedbackB"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\n/g, "\n") ?? "",
      evidenceChecks: [],
    };
  }
  throw new Error(`Failed to parse judge JSON after all attempts. Raw (first 400): ${raw.slice(0, 400)}`);
}

function parseScores(raw: unknown): DebaterScores | undefined {
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

function parseVerdict(raw: string, input: JudgeInput): SingleJudgeVerdict {
  const parsed = tryParseJson(raw);

  const validIds = new Set([input.debaterA.id, input.debaterB.id]);
  const winnerId: string | null =
    typeof parsed.winnerId === "string" && validIds.has(parsed.winnerId)
      ? parsed.winnerId
      : input.debaterA.id;

  const VALID_VERDICTS = new Set(["correct", "incorrect", "misleading", "disputed", "unsupported"]);
  const evidenceChecks: EvidenceCheck[] = Array.isArray(parsed.evidenceChecks)
    ? (parsed.evidenceChecks as Array<Record<string, unknown>>)
        .filter((e) => e && typeof e.claim === "string" && typeof e.verdict === "string")
        .map((e) => ({
          debater: String(e.debater ?? ""),
          claim: String(e.claim ?? ""),
          verdict: (VALID_VERDICTS.has(String(e.verdict)) ? e.verdict : "unsupported") as EvidenceCheck["verdict"],
          explanation: String(e.explanation ?? ""),
          source: typeof e.source === "string" && e.source ? e.source : undefined,
          importance:
            e.importance === "central" || e.importance === "supporting" || e.importance === "peripheral"
              ? e.importance
              : undefined,
        }))
    : [];

  // Accept either "summary" (new) or "explanation" (legacy) for the text field
  const explanation = String(parsed.summary ?? parsed.explanation ?? "");

  return {
    winnerId,
    explanation,
    privateFeedbackA: String(parsed.privateFeedbackA ?? ""),
    privateFeedbackB: String(parsed.privateFeedbackB ?? ""),
    evidenceChecks,
    scoresA: parseScores(parsed.debaterA_scores),
    scoresB: parseScores(parsed.debaterB_scores),
    biggestMistakeA: typeof parsed.biggestMistakeA === "string" ? parsed.biggestMistakeA : undefined,
    biggestAchievementA: typeof parsed.biggestAchievementA === "string" ? parsed.biggestAchievementA : undefined,
    biggestMistakeB: typeof parsed.biggestMistakeB === "string" ? parsed.biggestMistakeB : undefined,
    biggestAchievementB: typeof parsed.biggestAchievementB === "string" ? parsed.biggestAchievementB : undefined,
  };
}

/** Collect all chunks from a streaming chat.send() response into one string */
async function collectStream(
  stream: AsyncIterable<{ choices: Array<{ delta: { content?: string | null } }> }>,
  timeoutMs = 180_000,
): Promise<string> {
  let text = "";
  const deadline = Date.now() + timeoutMs;
  for await (const chunk of stream) {
    if (Date.now() > deadline) throw new Error("Stream timed out after " + timeoutMs + "ms");
    const content = chunk.choices[0]?.delta?.content;
    if (content) text += content;
  }
  return text.trim();
}

// ─── Shared system prompt ──────────────────────────────────────────────────────

function buildJudgingRubric(extra: string): string {
  return `You are an expert debate judge on the platform Arguably. You evaluate a full debate between two participants and produce ONE overall judgment.

## PRIMARY RULE
Factual accuracy is the most important factor. A debater cannot win if their argument relies on false, misleading, or unsupported claims. Persuasiveness does NOT override bad facts.

## MANDATORY RULES

### Names
Always use the debaters' actual usernames throughout your entire response. NEVER use "Debater A", "Debater B", "A", "B", "Proposition", "Opposition", or any positional label.

### Sources
Cite real, verifiable sources by name when applying to claim checks: "WHO Global TB Report 2023", "IPCC AR6 2021", "BLS Employment Situation Feb 2025", "IMF World Economic Outlook 2025", "Pew Research", etc. Do NOT invent citations. If genuinely uncertain, write a credible category (e.g., "established macroeconomic consensus") and be clear about the uncertainty.

## EVALUATION PROCESS

### STEP 1 — IDENTIFY KEY CLAIMS
Extract the most important factual or empirical claims from each side. Focus on claims that matter to the outcome — not minor details.

### STEP 2 — FACT-CHECK WITH REAL EVIDENCE
For each important claim, determine if it is:
- **correct** — confirmed by credible, verifiable evidence
- **incorrect** — directly contradicted by credible evidence
- **misleading** — partially true but deceptively framed, missing crucial context, or significantly exaggerated
- **disputed** — actively contested among credible experts; no clear consensus
- **unsupported** — asserted without adequate proof; unverifiable or too speculative

Be decisive: if a claim lacks evidence → mark it unsupported; if it exaggerates → misleading; if it is central and wrong → it heavily damages the argument.

### STEP 3 — SCORE EACH DEBATER (0–10 per dimension)
Score BOTH debaters on:
- **factuality** (MOST IMPORTANT) — are their major claims actually true?
- **evidence_quality** — how specific and credible is the evidence they cited?
- **argument_strength** — logical structure, consistency, relevance
- **rebuttal_quality** — how effectively they addressed the opponent's specific claims
- **clarity** — how clearly they expressed their position
- **persuasiveness** — overall persuasive impact

### STEP 4 — APPLY FACTUALITY DOMINANCE
Weights: factuality=35%, evidence_quality=25%, argument_strength=15%, rebuttal_quality=15%, clarity=5%, persuasiveness=5%

CRITICAL RULES:
- If factuality < 5 → cap final_score at 6.0
- If factuality < 3 → automatic loss (cap final_score at 3.0)
- A debater CANNOT win with false or unsupported core claims

### STEP 5 — FINAL VERDICT
Choose ONE winner. Base decision primarily on factual reliability. If both debaters have factual problems, decide based on whose CENTRAL claims are more accurate. No ties.

Write a 3–5 sentence summary: sharp fact-checker style, no fluff. Identify the KEY claims, state which were unsupported/incorrect, briefly reference evidence, explain why that determined the winner.

${extra}

Respond with ONLY valid JSON — no markdown fences, no commentary — matching this schema exactly:
`;
}

// ─── Judge A: Grok ─────────────────────────────────────────────────────────────

function buildGrokSystem(input: JudgeInput): string {
  return (
    buildJudgingRubric(
      "You are known for sharp, incisive fact-checking and zero tolerance for dishonesty or unsupported assertions. Call out false claims directly, even if the debater sounded confident.",
    ) + buildVerdictSchema(input)
  );
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
    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.3,
        maxTokens: 4000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: buildGrokSystem(input) },
          {
            role: "user",
            content: buildTranscriptText(input) + "\n\nFact-check this debate and provide your verdict JSON.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream);
    if (!raw) throw new Error("Empty response from Grok judge");
    return parseVerdict(raw, input);
  }
}

// ─── Judge B: Claude ───────────────────────────────────────────────────────────

function buildClaudeSystem(input: JudgeInput): string {
  return (
    buildJudgingRubric(
      "You are known for meticulous, dispassionate analysis. You are especially skilled at identifying misleading framing — claims that are technically true but create a false impression. You give no credit for rhetorical polish if the underlying facts are shaky.",
    ) + buildVerdictSchema(input)
  );
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
    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.3,
        maxTokens: 4000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: buildClaudeSystem(input) },
          {
            role: "user",
            content: buildTranscriptText(input) + "\n\nFact-check this debate and provide your verdict JSON.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream);
    if (!raw) throw new Error("Empty response from Claude judge");
    return parseVerdict(raw, input);
  }
}

// ─── Judge C: GPT — The Arbiter ───────────────────────────────────────────────

function buildArbiterSystem(input: JudgeInput): string {
  return (
    buildJudgingRubric(
      `You are the final arbitrating judge. You have access to the full debate transcript AND both peer verdicts below.

Additional instructions:
1. Read the full transcript independently and form your own assessment first.
2. Study both peer verdicts — note where they agree and where they differ.
3. Your claim-checking is the most authoritative. Cross-reference every significant factual claim against your knowledge. Be especially rigorous on claims the peer judges did not highlight.
4. Your explanation should briefly note where the peer judges agreed or diverged, and add any factual findings they missed.
5. You have the final word. Pick the winner whose factual case is stronger, regardless of peer judge votes.`,
    ) + buildVerdictSchema(input)
  );
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
    this.model = options.model ?? "openai/gpt-oss-120b";
  }

  async judgeWithPriorVerdicts(
    input: JudgeInput,
    priorVerdicts: Array<{ judgeName: string; verdict: SingleJudgeVerdict }>,
  ): Promise<SingleJudgeVerdict> {
    const transcriptText = buildTranscriptText(input);

    const priorSection =
      priorVerdicts.length > 0
        ? "\n\n" +
          priorVerdicts
            .map(({ judgeName, verdict }) => {
              const winnerName =
                verdict.winnerId === input.debaterA.id
                  ? input.debaterA.username
                  : verdict.winnerId === input.debaterB.id
                    ? input.debaterB.username
                    : "Tie";
              const claimSummary = verdict.evidenceChecks
                .slice(0, 5)
                .map((e) => `  • ${e.debater}: "${e.claim.slice(0, 60)}…" → ${e.verdict}`)
                .join("\n");
              return (
                `PEER VERDICT from ${judgeName}:\n` +
                `  Winner: ${winnerName}\n` +
                `  Analysis: ${verdict.explanation.slice(0, 400)}…\n` +
                `  Key claims checked:\n${claimSummary}`
              );
            })
            .join("\n\n")
        : "";

    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.25,
        maxTokens: 8000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: buildArbiterSystem(input) },
          {
            role: "user",
            content:
              transcriptText +
              priorSection +
              "\n\nNow deliver your authoritative final fact-check verdict JSON.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream, 360_000); // 6 min — Arbiter response is large
    if (!raw) throw new Error("Empty response from Arbiter judge");
    return parseVerdict(raw, input);
  }

  async judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    return this.judgeWithPriorVerdicts(input, []);
  }
}


