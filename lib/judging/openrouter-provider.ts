import { OpenRouter } from "@openrouter/sdk";
import type { DebaterScores, EvidenceCheck, IJudgingProvider, JudgeInput, SingleJudgeVerdict } from "./types";
import { db } from "@/lib/db";

// Fetch judge prompts from database with fallbacks
async function getJudgePrompt(type: string): Promise<string> {
  try {
    const prompt = await db.judgePrompt.findFirst({
      where: { type, isActive: true }
    });
    
    if (prompt) return prompt.prompt;
  } catch (error) {
    console.error(`Error fetching prompt for ${type}:`, error);
  }
  
  // Fallback prompts if database is unavailable
  const fallbacks: Record<string, string> = {
    judge1_grok: "You are Judge 1 (Grok), known for wit, humor, and unconventional thinking. Focus on factual accuracy above all else.",
    judge2_claude: "You are known for meticulous, dispassionate analysis. You are especially skilled at identifying misleading framing — claims that are technically true but create a false impression. You give no credit for rhetorical polish if the underlying facts are shaky.",
    judge3_chatgpt: "You are the final arbitrating judge. You have access to the full debate transcript AND both peer verdicts below. Your explanation should briefly note where the peer judges agreed or diverged, and add any factual findings they missed.",
  };
  
  return fallbacks[type] || "Evaluate this debate fairly and factually.";
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
    "summary": "<3 to 5 concise sentences explaining why this user won in public-facing language>"
  },
  "private_assessment": {
    "decision_summary": "<short internal summary of why the winner won>",
    "key_claim_checks": [
      {
        "username": "<${a} or ${b}>",
        "claim": "<specific factual claim from the transcript>",
        "verdict": "<correct|incorrect|misleading|disputed|unsupported>",
        "reason": "<short explanation>",
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
        "final_score": <weighted score with factuality dominance rules applied, rounded to 1 decimal>
      },
      "${b}": {
        "factuality": <0-10 integer>,
        "evidence_quality": <0-10 integer>,
        "argument_strength": <0-10 integer>,
        "rebuttal_quality": <0-10 integer>,
        "clarity": <0-10 integer>,
        "persuasiveness": <0-10 integer>,
        "final_score": <weighted score with factuality dominance rules applied, rounded to 1 decimal>
      }
    },
    "winner_reason": "<1 to 2 sentence internal explanation focused on factual accuracy>"
  }
}

Requirements:
- Include 3-8 claim checks covering the most important assertions from both debaters
- Use exact usernames ${a} and ${b}
- Apply factuality dominance rules: if factuality < 5 cap final_score at 6.0, if factuality < 3 cap at 3.0
- Choose winner based primarily on factual reliability`;
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

  // Extract evidence checks from new format
  const VALID_VERDICTS = new Set(["correct", "incorrect", "misleading", "disputed", "unsupported"]);
  const privateAssessment = parsed.private_assessment as Record<string, unknown> | undefined;
  const evidenceChecks: EvidenceCheck[] = Array.isArray(privateAssessment?.key_claim_checks)
    ? (privateAssessment.key_claim_checks as Array<Record<string, unknown>>)
        .filter((e) => e && typeof e.claim === "string" && typeof e.verdict === "string")
        .map((e) => ({
          debater: String(e.username ?? ""),
          claim: String(e.claim ?? ""),
          verdict: (VALID_VERDICTS.has(String(e.verdict)) ? e.verdict : "unsupported") as EvidenceCheck["verdict"],
          explanation: String(e.reason ?? ""),
          source: typeof e.source === "string" && e.source ? e.source : undefined,
          importance: undefined, // New format doesn't include importance
        }))
    : [];

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

// ─── Shared system prompt ──────────────────────────────────────────────────────

// buildJudgingRubric wraps the DB persona as a PREAMBLE before the factuality rules.
// The persona can set tone/style; the rubric's factuality rules always apply and cannot be overridden.
function buildJudgingRubric(extra: string): string {
  const preamble = extra ? `JUDGE PERSONA — tone and style guidance for this evaluation:\n${extra}\n\n` : "";
  return `${preamble}You are an expert debate judge on the platform Arguably. You evaluate a full debate between two participants and produce ONE overall judgment.

CRITICAL OUTPUT RULES
- Return ONLY valid JSON
- Do not wrap the JSON in markdown
- Do not include any text before or after the JSON
- Do not include emojis
- Use only plain ASCII characters
- Always use the debaters' real usernames
- No ties

PRIMARY RULE
Factual accuracy is the most important factor. A debater cannot win if their argument relies on false, misleading, or unsupported claims. Persuasiveness does NOT override bad facts.

EVALUATION PROCESS

STEP 1 - Identify the key factual or empirical claims from each side.
STEP 2 - Fact-check those claims using credible real-world knowledge and real source names where possible.
STEP 3 - Score both debaters from 0 to 10 on:
- factuality
- evidence_quality
- argument_strength
- rebuttal_quality
- clarity
- persuasiveness

STEP 4 - Apply these weights:
- factuality = 35
- evidence_quality = 25
- argument_strength = 15
- rebuttal_quality = 15
- clarity = 5
- persuasiveness = 5

CRITICAL SCORING RULES
- If factuality < 5, cap final_score at 6.0
- If factuality < 3, automatic loss and cap final_score at 3.0
- A debater cannot win with false or unsupported core claims

STEP 5 - Choose one winner based primarily on factual reliability.

Respond with ONLY valid JSON — no markdown fences, no commentary — matching this schema exactly:
`;
}

// ─── Judge A: Grok ─────────────────────────────────────────────────────────────

// Strip any embedded JSON schema blocks a persona prompt might contain (from old DB records)
function stripPersonaJsonSchema(prompt: string): string {
  // Remove everything from the first { that looks like a JSON schema block
  const schemaStart = prompt.search(/\n\s*Return JSON|\n\s*\{[\s\S]*"winner"/i);
  if (schemaStart !== -1) return prompt.slice(0, schemaStart).trim();
  return prompt;
}

async function buildGrokSystem(input: JudgeInput): Promise<string> {
  const raw = await getJudgePrompt("judge1_grok");
  return buildJudgingRubric(stripPersonaJsonSchema(raw)) + buildVerdictSchema(input);
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
  const raw = await getJudgePrompt("judge2_claude");
  return buildJudgingRubric(stripPersonaJsonSchema(raw)) + buildVerdictSchema(input);
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
  const raw = await getJudgePrompt("judge3_chatgpt");
  const persona = stripPersonaJsonSchema(raw);
  const resultStyle = await getJudgePrompt("official_result");
  return buildJudgingRubric(persona) + buildVerdictSchema(input, resultStyle || undefined);
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
                .map((e) => `  • ${e.debater}: "${e.claim.slice(0, 60)}..." → ${e.verdict}`)
                .join("\n");
              return (
                `PEER VERDICT from ${judgeName}:\n` +
                `  Winner: ${winnerName}\n` +
                `  Analysis: ${verdict.explanation.slice(0, 400)}...\n` +
                `  Key claims checked:\n${claimSummary}`
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
              "\n\nNow deliver your authoritative final fact-check verdict JSON.",
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
  const model = options.model ?? "openai/gpt-oss-120b";
  const a = input.debaterA.username;
  const b = input.debaterB.username;

  const extraInstruction = await getJudgePrompt("private_feedback");

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
${extraInstruction ? `\nADDITIONAL INSTRUCTION — after generating each feedback value, also append this sentence verbatim on a new line: "${extraInstruction}"` : ""}

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

  const raw = await withRetry(doRequest);
  if (!raw) throw new Error("Empty response from feedback generator");

  const parsed = tryParseJson(raw);
  const feedbackA = typeof parsed.feedbackA === "string" ? parsed.feedbackA.trim() : "";
  const feedbackB = typeof parsed.feedbackB === "string" ? parsed.feedbackB.trim() : "";
  if (!feedbackA || !feedbackB) throw new Error("Missing feedbackA or feedbackB in response");
  return { feedbackA, feedbackB };
}

