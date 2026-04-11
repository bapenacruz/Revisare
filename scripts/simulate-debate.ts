#!/usr/bin/env npx tsx
/**
 * scripts/simulate-debate.ts
 *
 * Interactive CLI that creates a real debate in the database without the UI.
 * Useful for generating training data and testing the judging pipeline.
 *
 * Usage:
 *   npx tsx scripts/simulate-debate.ts
 *
 * Options when prompted:
 *   - Choose debaters from seeded personas or any existing username
 *   - Type arguments manually, or let AI auto-generate them for persona characters
 *   - Runs the full judge panel at the end and prints the verdict
 */

import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { db } from "@/lib/db";
import { OpenRouter } from "@openrouter/sdk";
import { getTurnSequence, ROUND_LABEL, getRoundTimer } from "@/lib/debate-state";
import { judgeDebate } from "@/lib/judging/run";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: join(process.cwd(), ".env") });
const rl = readline.createInterface({ input, output });

// ── helpers ──────────────────────────────────────────────────────────────────

function hr(char = "─") {
  console.log(char.repeat(60));
}

function bold(s: string) {
  return `\x1b[1m${s}\x1b[0m`;
}

function cyan(s: string) {
  return `\x1b[36m${s}\x1b[0m`;
}

function green(s: string) {
  return `\x1b[32m${s}\x1b[0m`;
}

function yellow(s: string) {
  return `\x1b[33m${s}\x1b[0m`;
}

function dim(s: string) {
  return `\x1b[2m${s}\x1b[0m`;
}

async function ask(prompt: string): Promise<string> {
  return (await rl.question(`${cyan("?")} ${prompt} `)).trim();
}

async function choose<T extends { label: string }>(
  prompt: string,
  options: T[],
): Promise<T> {
  console.log(cyan(`\n${prompt}`));
  options.forEach((o, i) => console.log(`  ${dim(`${i + 1}.`)} ${o.label}`));
  while (true) {
    const raw = await ask(`Enter number (1-${options.length}):`);
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= options.length) return options[n - 1];
    console.log(yellow("  Invalid choice, try again."));
  }
}

// ── AI argument generator ─────────────────────────────────────────────────────

interface Persona {
  username: string;
  bio?: string;
  politicalLeaning?: string;
  education_level?: string;
  debateStyle?: string;
  strongTopics?: string[];
  synthetic?: boolean;
  prompt?: string;
  writing_style_details?: {
    common_phrases: string[];
    tone: string;
    sentence_structure: string;
    formality: string;
  };
}

function getAiClient(): OpenRouter | null {
  if (!process.env.OPENROUTER_API_KEY) return null;
  return new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
      httpReferer: "https://revisare.app",
      appTitle: "Revisare Debate Simulator",
  });
}

async function generateArgument(
  client: OpenRouter,
  persona: Persona,
  motion: string,
  side: "for" | "against",
  round: string,
  previousTurns: { speaker: string; content: string }[],
): Promise<string> {
  const model = process.env.GENERAL_AI_MODEL ?? "google/gemini-2.5-flash-lite";

  const history = previousTurns
    .map((t) => `[${t.speaker}]: ${t.content}`)
    .join("\n\n");

  const styleNote = persona.writing_style_details
    ? `Writing style: ${persona.writing_style_details.tone} tone, ${persona.writing_style_details.formality} formality, ${persona.writing_style_details.sentence_structure} sentences. Common phrases: ${persona.writing_style_details.common_phrases.join(", ")}.`
    : `Debate style: ${persona.debateStyle ?? "Logical and methodical"}`;

  const system = persona.prompt
    ? `${persona.prompt}

You are arguing ${side.toUpperCase()} the motion: "${motion}"
This is your ${round}.

${styleNote}

Rules:
- Stay in character
- Write 150-350 words of compelling debate argument
- Reference and rebut specific points from previous speakers when relevant
- NO headers, NO bullet points — flowing prose only
- Do NOT use phrases like "In conclusion" in opening statements`
    : `You are roleplaying as ${persona.username} in a structured debate.
Persona: ${persona.bio ?? "A thoughtful debater"}
${styleNote}
Political leaning: ${persona.politicalLeaning ?? "Unknown"}

You are arguing ${side.toUpperCase()} the motion: "${motion}"
This is your ${round}.

Rules:
- Stay in character as ${persona.username}
- Write 150-350 words of compelling debate argument
- Reference and rebut specific points from previous speakers when relevant
- NO headers, NO bullet points — flowing prose only
- Do NOT use phrases like "In conclusion" in opening statements`;

  const userMsg = previousTurns.length > 0
    ? `Previous arguments in this debate:\n\n${history}\n\nNow write your ${round} arguing ${side} the motion.`
    : `Write your ${round} arguing ${side} the motion: "${motion}"`;

  const stream = await client.chat.send({
    chatRequest: {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      stream: true,
      maxTokens: 600,
    },
  });

  let result = "";
  for await (const chunk of stream) {
    result += chunk.choices[0]?.delta?.content ?? "";
  }
  return result.trim();
}

// ── main ──────────────────────────────────────────────────────────────────────

async function selectUser(label: string, personaMap: Map<string, Persona>): Promise<{ id: string; username: string; persona: Persona | null }> {
  const personas = Array.from(personaMap.entries());

  const options = [
    ...personas.map(([, p]) => ({ label: `${p.username} ${dim(`— ${p.bio?.slice(0, 60) ?? ""}`)}`, value: p.username })),
    { label: "Enter a different username manually", value: "__manual__" },
  ];

  console.log(cyan(`\nSelect ${label}:`));
  options.forEach((o, i) => console.log(`  ${dim(`${i + 1}.`)} ${o.label}`));

  let username: string;
  while (true) {
    const raw = await ask(`Enter number (1-${options.length}):`);
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= options.length) {
      const chosen = options[n - 1];
      if (chosen.value === "__manual__") {
        username = await ask("Enter username:");
      } else {
        username = chosen.value;
      }
      break;
    }
    console.log(yellow("  Invalid choice."));
  }

  const user = await db.user.findUnique({ where: { username }, select: { id: true, username: true } });
  if (!user) throw new Error(`User "${username}" not found in database. Run seed-personas.ts first.`);

  return { id: user.id, username: user.username, persona: personaMap.get(username) ?? null };
}

async function main() {
  console.log(bold("\n⚔  Revisare — Debate Simulator\n"));
  hr();

  // Load personas for reference
  const personasPath = join(process.cwd(), "lib", "data", "personas.json");
  const personas: Persona[] = JSON.parse(readFileSync(personasPath, "utf-8"));
  const personaMap = new Map(personas.map((p) => [p.username, p]));

  // ── Select debaters ────────────────────────────────────────────────────────
  const debaterA = await selectUser("Debater A (argues FOR)", personaMap);
  console.log(green(`  ✓ Debater A: ${debaterA.username}`));

  let debaterB = await selectUser("Debater B (argues AGAINST)", personaMap);
  while (debaterB.id === debaterA.id) {
    console.log(yellow("  Debater B must be different from Debater A."));
    debaterB = await selectUser("Debater B (argues AGAINST)", personaMap);
  }
  console.log(green(`  ✓ Debater B: ${debaterB.username}`));

  // ── Motion ────────────────────────────────────────────────────────────────
  hr();
  const motion = await ask("Enter the debate motion (e.g. 'This house believes that AI will eliminate more jobs than it creates'):").then(v => v || "This house believes that AI will eliminate more jobs than it creates");
  console.log(green(`  ✓ Motion: "${motion}"`));

  // ── Format ────────────────────────────────────────────────────────────────
  const formatChoice = await choose("Select format:", [
    { label: "Quick — Opening + Rebuttal + Closing (6 turns, ~10 min)", value: "quick" },
    { label: "Standard — Opening + Rebuttal + Closing (6 turns, ~15 min)", value: "standard" },
  ] as { label: string; value: string }[]);
  const format = (formatChoice as unknown as { value: string }).value;

  // ── Category ──────────────────────────────────────────────────────────────
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, slug: true, label: true, emoji: true },
  });

  if (categories.length === 0) throw new Error("No active categories in DB. Seed categories first.");

  const catChoice = await choose(
    "Select category:",
    categories.map((c) => ({ label: `${c.emoji} ${c.label}`, id: c.id })),
  ) as unknown as { label: string; id: string };
  const categoryId = catChoice.id;

  // ── AI mode ──────────────────────────────────────────────────────────────
  hr();
  const aiClient = getAiClient();

  let aiModeA = false;
  let aiModeB = false;

  if (aiClient) {
    const modeChoice = await choose("Argument input mode:", [
      { label: "Manual — I type all arguments for both debaters", value: "manual" },
      { label: `AI generates for ${debaterA.username} only (you type ${debaterB.username})`, value: "ai_a" },
      { label: `AI generates for ${debaterB.username} only (you type ${debaterA.username})`, value: "ai_b" },
      { label: "AI generates for BOTH debaters automatically", value: "ai_both" },
    ] as { label: string; value: string }[]);
    const mode = (modeChoice as unknown as { value: string }).value;
    aiModeA = mode === "ai_a" || mode === "ai_both";
    aiModeB = mode === "ai_b" || mode === "ai_both";
  } else {
    console.log(yellow("\n  No OPENROUTER_API_KEY found — all arguments will be typed manually.\n"));
  }

  // ── Ranked ────────────────────────────────────────────────────────────────
  const rankedInput = await ask("Ranked match? (yes/no) [yes]:");
  const ranked = rankedInput.toLowerCase() !== "no";

  // ── Create Challenge + Debate in DB ───────────────────────────────────────
  hr();
  console.log(dim("Creating debate records in database..."));

  const challenge = await db.challenge.create({
    data: {
      type: "direct",
      status: "active",
      motion,
      categoryId,
      format,
      ranked,
      isPublic: true,
      timerPreset: 0,
      creatorId: debaterA.id,
      targetId: debaterB.id,
      creatorAccepted: true,
      targetAccepted: true,
      lockedAt: new Date(),
    },
  });

  // Coin flip: debaterA goes first
  const debate = await db.debate.create({
    data: {
      challengeId: challenge.id,
      categoryId,
      motion,
      format,
      ranked,
      isPublic: true,
      timerPreset: getRoundTimer(format, "opening"),
      status: "active",
      phase: "typing",
      debaterAId: debaterA.id,
      debaterBId: debaterB.id,
      coinFlipWinnerId: debaterA.id,
      currentTurnIndex: 0,
      currentUserId: debaterA.id,
      startedAt: new Date(),
    },
  });

  console.log(green(`  ✓ Debate created: ${debate.id}`));
  console.log(green(`  ✓ Challenge: ${challenge.id}`));

  // ── Turn sequence ──────────────────────────────────────────────────────────
  const turnSequence = getTurnSequence(format, debaterA.id, debaterA.id, debaterB.id);
  const turnHistory: { speaker: string; content: string }[] = [];

  hr("═");
  console.log(bold(`\n  Motion: "${motion}"`));
  console.log(`  ${debaterA.username} (FOR)  vs  ${debaterB.username} (AGAINST)\n`);
  hr("═");

  for (const turn of turnSequence) {
    const isA = turn.userId === debaterA.id;
    const speaker = isA ? debaterA : debaterB;
    const side = isA ? "for" : "against";
    const useAi = isA ? aiModeA : aiModeB;
    const roundLabel = ROUND_LABEL[turn.roundName];

    console.log(`\n${bold(`[Turn ${turn.turnIndex + 1}/${turnSequence.length}] ${speaker.username} — ${roundLabel}`)}`);
    console.log(dim(`  ${speaker.username} is arguing ${side} the motion.\n`));

    let content: string;

    if (useAi && aiClient) {
      const persona = speaker.persona ?? { username: speaker.username };
      process.stdout.write(dim("  Generating argument via AI... "));
      content = await generateArgument(
        aiClient,
        persona,
        motion,
        side,
        roundLabel.toLowerCase(),
        turnHistory,
      );
      console.log(green("done\n"));
      console.log(`${dim("  Auto-generated argument:")}\n`);
      console.log(content
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"));
      console.log();
    } else {
      console.log(dim(`  Type the argument for ${speaker.username} below.`));
      console.log(dim("  (Press Enter twice when done, or type SKIP to use a placeholder)\n"));

      const lines: string[] = [];
      let emptyCount = 0;

      process.stdout.write("  > ");
      // Simple multi-line input: keep reading until double Enter or SKIP
      while (true) {
        const line = await rl.question("  ");
        if (line === "SKIP") {
          lines.push(`[${speaker.username} chose not to elaborate on their ${roundLabel.toLowerCase()}.]`);
          break;
        }
        if (line === "") {
          emptyCount++;
          if (emptyCount >= 2) break;
        } else {
          emptyCount = 0;
          lines.push(line);
        }
      }
      content = lines.join("\n").trim() || `${speaker.username} passed this round.`;
    }

    // Save turn to DB
    await db.debateTurn.create({
      data: {
        debateId: debate.id,
        userId: speaker.id,
        roundName: turn.roundName,
        content,
        submittedAt: new Date(),
      },
    });

    turnHistory.push({ speaker: speaker.username, content });

    // Update debate current turn pointer
    const nextIndex = turn.turnIndex + 1;
    const nextTurn = turnSequence[nextIndex];
    await db.debate.update({
      where: { id: debate.id },
      data: {
        currentTurnIndex: nextIndex,
        currentUserId: nextTurn?.userId ?? null,
      },
    });

    console.log(green(`  ✓ Turn saved.\n`));
    hr();
  }

  // ── Complete the debate ────────────────────────────────────────────────────
  await db.debate.update({
    where: { id: debate.id },
    data: {
      status: "completed",
      phase: "completed",
      completedAt: new Date(),
    },
  });

  console.log(bold("\n  All turns submitted. Running judge panel...\n"));

  // ── Judge ─────────────────────────────────────────────────────────────────
  try {
    await judgeDebate(debate.id);
  } catch (err) {
    console.error(yellow("\n  Judge panel error:"), err);
    console.log(dim("  Debate is saved, but judging failed. You can retry via the API."));
    rl.close();
    await db.$disconnect();
    return;
  }

  // ── Print verdict ──────────────────────────────────────────────────────────
  const consensus = await db.judgeResult.findFirst({
    where: { debateId: debate.id, judgeId: "consensus" },
  });

  const updatedDebate = await db.debate.findUnique({
    where: { id: debate.id },
    select: { winnerId: true },
  });

  hr("═");
  console.log(bold("\n  ⚖  VERDICT\n"));

  if (updatedDebate?.winnerId) {
    const winner = updatedDebate.winnerId === debaterA.id ? debaterA.username : debaterB.username;
    console.log(`  🏆 Winner: ${bold(green(winner))}\n`);
  } else {
    console.log(`  🤝 Result: ${bold("Tie")}\n`);
  }

  if (consensus?.explanation) {
    console.log(`  ${consensus.explanation}\n`);
  }

  hr("═");
  console.log(dim(`\n  Debate ID:   ${debate.id}`));
  console.log(dim(`  Challenge ID: ${challenge.id}`));
  console.log(dim(`  View results at: /debates/${challenge.id}/results\n`));

  rl.close();
}

main().catch((err) => {
  console.error("\n\x1b[31mFatal error:\x1b[0m", err);
  rl.close();
  process.exit(1);
});
