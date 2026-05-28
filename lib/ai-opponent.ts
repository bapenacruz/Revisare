/**
 * AI practice debate opponent using Gemini (via OpenRouter).
 *
 * Rules:
 * - Matches the user's writing level & argument sophistication
 * - No internet research — pure logical reasoning only
 * - Calibrated not to always win; provides a challenging but fair practice partner
 */

import { OpenRouter } from "@openrouter/sdk";
import type { RoundName } from "./debate-state";
import { getMinChars, getMaxChars } from "./debate-state";

// Fixed ID for the AI system bot user — kept here as a constant to use across the app
export const AI_OPPONENT_USER_ID = "ai_opponent_system_v1";
export const AI_OPPONENT_USERNAME = "revisare.ai";

const AI_MODEL = "google/gemini-2.5-flash-lite";

interface DebateTurnContext {
  userId: string;
  username: string;
  roundName: string;
  content: string;
}

interface GenerateTurnOptions {
  motion: string;
  categoryLabel: string;
  aiSide: "proposition" | "opposition";
  userSide: "proposition" | "opposition";
  roundName: RoundName;
  previousTurns: DebateTurnContext[];
  userUsername: string;
}

function estimateUserStats(
  turns: DebateTurnContext[],
  userUsername: string,
): { level: string; avgLength: number; lastLength: number } {
  // Filter by username but also exclude the AI constant username
  const userTurns = turns.filter((t) => t.username === userUsername && t.username !== AI_OPPONENT_USERNAME);
  if (userTurns.length === 0) return { level: "intermediate", avgLength: 280, lastLength: 280 };

  const avgLength = Math.round(userTurns.reduce((s, t) => s + t.content.length, 0) / userTurns.length);
  const lastLength = userTurns[userTurns.length - 1].content.length;
  const combined = userTurns.map((t) => t.content).join(" ");
  const words = combined.split(/\s+/);
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / (words.length || 1);

  let level: string;
  if (avgLength < 150 || avgWordLen < 4.2) level = "beginner";
  else if (avgLength < 450 || avgWordLen < 5.0) level = "intermediate";
  else level = "advanced";

  return { level, avgLength, lastLength };
}

function buildSystemPrompt(opts: GenerateTurnOptions, userLevel: string, targetLength: number): string {
  const sideLabel =
    opts.aiSide === "proposition" ? "PROPOSITION (arguing FOR the motion)" : "OPPOSITION (arguing AGAINST the motion)";

  const levelInstructions: Record<string, string> = {
    beginner: `You are mimicking a BEGINNER debater. This means:
- Write with VERY simple words. Avoid any academic or formal vocabulary.
- Use casual, informal language — contractions ("don't", "it's"), simple phrases.
- Make only ONE main point. Do not structure your argument — just say your thought.
- Include imperfect reasoning: make a logical leap or overstatement that a beginner would make.
- Write like someone typing quickly without heavy editing. Some slightly run-on sentences are fine.
- DO NOT use phrases like "Furthermore", "In conclusion", "It is evident that", "One must consider" — a beginner would never say these.`,
    intermediate: `You are mimicking an INTERMEDIATE debater. This means:
- Use everyday language with occasional more formal words, but keep it natural.
- Make 2 points with basic supporting reasoning, but don't perfectly anticipate every counter-argument.
- Your argument can have a small gap or not fully develop one point.
- Avoid academic phrases. Sound like a confident but non-expert person making their case.
- DO NOT use sophisticated rhetorical structures or precise logical frameworks.`,
    advanced: `You are mimicking an ADVANCED debater. Use well-reasoned arguments with clear structure, engage with the opponent's points, and demonstrate strong analytical thinking. Be genuinely challenging but not superhuman.`,
  };

  return `You are an AI debate practice partner on Revisare. Your entire job is to be a fair practice opponent — NOT to win.

DEBATE MOTION: "${opts.motion}"
CATEGORY: ${opts.categoryLabel}
YOUR ROLE: ${sideLabel}

CRITICAL RULES — FOLLOW EXACTLY:

1. MATCH THE EXACT LENGTH: Your response MUST be approximately ${targetLength} characters (±20%). This is the most important rule. If your opponent wrote 150 characters, you write ~150 characters. Do not write more.

2. MATCH THEIR WRITING LEVEL:
${levelInstructions[userLevel] ?? levelInstructions["intermediate"]}

3. NO INTERNET RESEARCH. Never cite statistics, studies, or news events. Argue from common sense and basic principles only.

4. WRITE AS A HUMAN. Do not mention being an AI. No bullet points, no headers, no "In conclusion", no "As the ${opts.aiSide}". Just write the argument as a person would type it.

5. PURPOSE: You exist to help your opponent practice and improve, not to beat them. A good practice session means they feel challenged but capable.`;
}

function buildUserMessage(opts: GenerateTurnOptions, roundName: RoundName, targetLength: number): string {
  const roundLabels: Record<RoundName, string> = {
    opening: "Opening Statement",
    rebuttal: "Rebuttal",
    crossfire: "Crossfire",
    summary: "Summary",
    closing: "Closing Statement",
  };
  const min = getMinChars(roundName);

  let transcript = "";
  for (const turn of opts.previousTurns) {
    const side = turn.username === AI_OPPONENT_USERNAME ? `You (AI, ${opts.aiSide})` : `Opponent (${opts.userSide})`;
    transcript += `--- ${side} | ${turn.roundName} ---\n${turn.content}\n\n`;
  }

  return `${transcript.length > 0 ? `DEBATE SO FAR:\n${transcript}\n` : ""}Write your ${roundLabels[roundName]} now. Target length: ~${targetLength} characters (minimum ${min}). No more than ${Math.round(targetLength * 1.25)} characters.`;
}

let _client: OpenRouter | null = null;
function getClient(): OpenRouter | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new OpenRouter({ apiKey: key, httpReferer: "https://revisare.com", appTitle: "Revisare" });
  }
  return _client;
}

export async function generateAiOpponentTurn(opts: GenerateTurnOptions): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const { level: userLevel, avgLength, lastLength } = estimateUserStats(opts.previousTurns, opts.userUsername);

  // Target the AI's response length to closely match what the human actually writes.
  // Use the average of their last turn length and overall average to be responsive.
  const roundMax = getMaxChars(opts.roundName);
  const roundMin = getMinChars(opts.roundName);
  const humanTarget = Math.round((avgLength + lastLength) / 2);
  // Clamp to valid range, but bias towards the human's actual length
  const targetLength = Math.max(roundMin + 10, Math.min(humanTarget, roundMax));

  // Budget tokens roughly: ~4 chars/token, add 25% headroom
  const maxTokens = Math.max(80, Math.ceil(targetLength / 3.5));

  const systemPrompt = buildSystemPrompt(opts, userLevel, targetLength);
  const userMessage = buildUserMessage(opts, opts.roundName, targetLength);

  try {
    const stream = await client.chat.send({
      chatRequest: {
        model: AI_MODEL,
        temperature: 0.8,
        maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
      },
    });

    let text = "";
    for await (const chunk of stream) {
      const content = (chunk as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta?.content;
      if (content) text += content;
    }

    const trimmed = text.trim();
    const hardMax = Math.round(targetLength * 1.3);

    // Hard-truncate at a sentence boundary if over target
    let result = trimmed;
    if (result.length > hardMax) {
      // Try to cut at last sentence end before the limit
      const cutPoint = result.lastIndexOf(".", hardMax);
      result = cutPoint > roundMin ? result.slice(0, cutPoint + 1) : result.slice(0, hardMax);
    }
    // If under min (model was too brief), pad with a minimal continuation
    if (result.length < roundMin) {
      result = result + " I maintain my position on this point.";
    }
    return result;
  } catch (err) {
    console.error("[AI Opponent] Generation failed:", err);
    return null;
  }
}
