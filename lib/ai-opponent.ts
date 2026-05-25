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
export const AI_OPPONENT_USERNAME = "AI";

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

function estimateUserLevel(turns: DebateTurnContext[], userUsername: string): string {
  const userTurns = turns.filter((t) => t.username === userUsername);
  if (userTurns.length === 0) return "intermediate";

  const avgLen = userTurns.reduce((s, t) => s + t.content.length, 0) / userTurns.length;
  const combined = userTurns.map((t) => t.content).join(" ");
  // Simple heuristic: sentence complexity by avg word length + argument count
  const words = combined.split(/\s+/);
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / (words.length || 1);

  if (avgLen < 200 || avgWordLen < 4.5) return "beginner";
  if (avgLen < 600 || avgWordLen < 5.2) return "intermediate";
  return "advanced";
}

function buildSystemPrompt(opts: GenerateTurnOptions, userLevel: string): string {
  const sideLabel =
    opts.aiSide === "proposition" ? "PROPOSITION (arguing FOR the motion)" : "OPPOSITION (arguing AGAINST the motion)";

  const levelInstructions = {
    beginner: `Your opponent is a beginner debater. Write with simple, clear language. Short sentences. Avoid jargon. Make 1-2 main points. Do not overwhelm with arguments. Intentionally limit the depth of your analysis to match their level — you are not trying to win easily, you are helping them learn.`,
    intermediate: `Your opponent is an intermediate debater. Use moderately structured arguments. Make 2-3 clear points with brief supporting reasoning. Avoid overly academic language. Be competitive but not overwhelming.`,
    advanced: `Your opponent is an advanced debater. Engage deeply with their arguments. Use well-structured reasoning, anticipate counter-arguments, and demonstrate strong analytical depth. Be genuinely challenging.`,
  }[userLevel] ?? "";

  return `You are an AI debate practice partner on Revisare, a structured debate platform.

DEBATE MOTION: "${opts.motion}"
CATEGORY: ${opts.categoryLabel}
YOUR ROLE: ${sideLabel}

YOUR ABSOLUTE RULES:
1. NO INTERNET RESEARCH. You must not cite recent statistics, news events, or any information you cannot derive from general knowledge and logic. If you would need to look something up, argue from principle instead.
2. MATCH YOUR OPPONENT'S LEVEL. ${levelInstructions}
3. DO NOT ALWAYS WIN. Your purpose is to be a practice partner, not to dominate. Calibrate your argument strength to be competitive but fair.
4. WRITE AS A HUMAN DEBATER. Do not mention you are an AI. Write as if you are a thoughtful human debater.
5. STAY ON TOPIC. Every sentence must directly relate to the motion.
6. FORMAT: Write flowing prose debate text only — no bullet points, no headers, no meta-commentary. Do not say "In conclusion" or "As the ${opts.aiSide}" — just write the argument.`;
}

function buildUserMessage(opts: GenerateTurnOptions, roundName: RoundName): string {
  const roundLabels: Record<RoundName, string> = {
    opening: "Opening Statement",
    rebuttal: "Rebuttal",
    crossfire: "Crossfire",
    summary: "Summary",
    closing: "Closing Statement",
  };
  const min = getMinChars(roundName);
  const max = getMaxChars(roundName);

  let transcript = "";
  for (const turn of opts.previousTurns) {
    const side = turn.username === AI_OPPONENT_USERNAME ? `You (AI, ${opts.aiSide})` : `Opponent (${opts.userSide})`;
    transcript += `--- ${side} | ${turn.roundName} ---\n${turn.content}\n\n`;
  }

  return `${transcript.length > 0 ? `DEBATE SO FAR:\n${transcript}\n` : ""}Write your ${roundLabels[roundName]} now.
Requirements:
- Length: ${min}–${max} characters
- Pure logical reasoning only — no internet sources, no statistics you cannot verify from memory
- Match your opponent's level and style`;
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

  const userLevel = estimateUserLevel(opts.previousTurns, opts.userUsername);
  const systemPrompt = buildSystemPrompt(opts, userLevel);
  const userMessage = buildUserMessage(opts, opts.roundName);

  try {
    const stream = await client.chat.send({
      chatRequest: {
        model: AI_MODEL,
        temperature: 0.75,
        maxTokens: 1200,
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
    const min = getMinChars(opts.roundName);
    const max = getMaxChars(opts.roundName);

    // Truncate if over max
    if (trimmed.length > max) return trimmed.slice(0, max);
    // If under min (model was too brief), pad with a generic acknowledgement
    if (trimmed.length < min) {
      return trimmed + " " + "I stand by this position and look forward to the next round of this debate.";
    }
    return trimmed;
  } catch (err) {
    console.error("[AI Opponent] Generation failed:", err);
    return null;
  }
}
