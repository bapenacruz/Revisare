import { OpenRouter } from "@openrouter/sdk";

/**
 * General-purpose AI client using Gemini Flash Lite via OpenRouter.
 * Used for non-judging features: topic/motion suggestions, etc.
 *
 * SETUP:
 *   OPENROUTER_API_KEY=sk-or-v1-...   (your general key from openrouter.ai/settings/keys)
 *   GENERAL_AI_MODEL=google/gemini-2.5-flash-lite   (optional override)
 *
 * Without the key, all functions return null/fallback values silently.
 */

const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

let _client: OpenRouter | null = null;

function getClient(): OpenRouter | null {
  if (!process.env.OPENROUTER_API_KEY) return null;
  if (_client) return _client;
  _client = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    httpReferer: "https://revisare.app",
    appTitle: "Revisare Debate Platform",
  });
  return _client;
}

function getModel(): string {
  return process.env.GENERAL_AI_MODEL ?? DEFAULT_MODEL;
}

/**
 * Simple one-shot text completion via Gemini Flash Lite (streaming, collected to string).
 * Returns null if the API key is absent.
 */
export async function aiComplete(
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const stream = await client.chat.send({
      chatRequest: {
        model: getModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
      },
    });

    let text = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) text += content;
    }
    return text.trim() || null;
  } catch (err) {
    console.error("[AI] General completion failed:", err);
    return null;
  }
}

/**
 * Suggest 3 debate motions for a given topic/category.
 * Returns an empty array when AI is unavailable.
 */
export async function suggestMotions(
  topic: string,
  category: string,
): Promise<string[]> {
  const result = await aiComplete(
    `You are a debate topic expert. Generate exactly 3 well-formed debate motions for structured academic debate.
Format: return ONLY a JSON array of 3 strings, no commentary.
Rules: Each motion should start with "This House..." or "This House believes...", be specific and arguable, be suitable for a ${category} debate.`,
    `Topic: ${topic}`,
  );

  if (!result) return [];
  try {
    const parsed = JSON.parse(result) as unknown;
    if (Array.isArray(parsed)) {
      return (parsed as unknown[])
        .filter((m) => typeof m === "string")
        .slice(0, 3) as string[];
    }
    return [];
  } catch {
    return [];
  }
}
