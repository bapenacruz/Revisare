#!/usr/bin/env npx tsx
/**
 * scripts/infer-profiles.ts
 *
 * For every real user (synthetic: false) in lib/data/personas.json who has
 * completed at least one debate, uses AI to infer and populate:
 *   - writing_style_details (tone, formality, sentence_structure, common_phrases)
 *   - prompt  (AI roleplay instruction)
 *   - debateStyle
 *   - politicalLeaning
 *   - strongTopics / weakTopics
 *
 * Only updates fields that are currently null — existing data is preserved.
 * Run periodically (e.g. nightly) or manually:
 *
 *   npx tsx scripts/infer-profiles.ts
 *   npx tsx scripts/infer-profiles.ts --username alice  (single user)
 *   npx tsx scripts/infer-profiles.ts --dry-run         (no file write)
 */

import { db } from "@/lib/db";
import { OpenRouter } from "@openrouter/sdk";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: join(process.cwd(), ".env") });

// ── types ─────────────────────────────────────────────────────────────────────

interface WritingStyleDetails {
  common_phrases: string[];
  tone: string;
  sentence_structure: string;
  formality: string;
}

interface PersonaEntry {
  username: string;
  name: string | null;
  email: string;
  password: string;
  synthetic: boolean;
  culture: string | null;
  age: number | null;
  gender: string | null;
  bio: string | null;
  politicalLeaning: string | null;
  education_level: string | null;
  writing_style_details: WritingStyleDetails | null;
  prompt: string | null;
  debateStyle: string | null;
  strongTopics: string[];
  weakTopics: string[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function bold(s: string)   { return `\x1b[1m${s}\x1b[0m`; }
function green(s: string)  { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function dim(s: string)    { return `\x1b[2m${s}\x1b[0m`; }
function hr()              { console.log("─".repeat(60)); }

// ── AI inference ──────────────────────────────────────────────────────────────

async function inferProfile(
  client: OpenRouter,
  username: string,
  turns: { motion: string; side: "for" | "against"; roundName: string; content: string }[],
): Promise<Partial<PersonaEntry>> {
  const model = process.env.GENERAL_AI_MODEL ?? "google/gemini-2.5-flash-lite";

  const transcript = turns
    .map((t) => `[${t.roundName.toUpperCase()} — arguing ${t.side}]\nMotion: "${t.motion}"\n${t.content}`)
    .join("\n\n---\n\n");

  const system = `You are an analyst reading a user's debate history to infer their communication profile.
Return a JSON object with EXACTLY these fields — no extra keys, no markdown fences:
{
  "politicalLeaning": "brief label e.g. center-left, libertarian, social conservative, realist (max 30 chars)",
  "debateStyle": "one sentence describing how they argue (max 100 chars)",
  "strongTopics": ["topic1", "topic2"],
  "weakTopics": ["topic1", "topic2"],
  "writing_style_details": {
    "tone": "one word e.g. passionate, analytical, measured, folksy, legalistic",
    "sentence_structure": "short | mixed | long",
    "formality": "low | medium | high",
    "common_phrases": ["phrase1", "phrase2", "phrase3"]
  },
  "prompt": "A 1-2 sentence AI roleplay instruction starting with 'You are [username]...'"
}`;

  const userMsg = `Here are debate turns written by user "${username}":\n\n${transcript}\n\nInfer their profile.`;

  const resp = await client.chat.send({
    chatRequest: {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      stream: false,
      maxTokens: 400,
    },
  });

  const raw = (resp.choices[0]?.message?.content ?? "").trim();

  // Strip possible markdown fences
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  const parsed = JSON.parse(jsonStr);
  return parsed as Partial<PersonaEntry>;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const singleUser = args.includes("--username")
    ? args[args.indexOf("--username") + 1]
    : null;

  console.log(bold("\n🔍  Revisare — Profile Inference\n"));
  if (dryRun) console.log(yellow("  DRY RUN — no file will be written\n"));

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("  ✗ OPENROUTER_API_KEY not set — cannot infer profiles.");
    process.exit(1);
  }

  const client = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    httpReferer: "https://revisare.app",
      appTitle: "Revisare Profile Inference",
  });

  const personasPath = join(process.cwd(), "lib", "data", "personas.json");
  const personas: PersonaEntry[] = JSON.parse(readFileSync(personasPath, "utf-8"));

  // Filter to real users only (or a single specified user)
  const targets = personas.filter((p) => {
    if (p.synthetic !== false) return false;
    if (singleUser && p.username !== singleUser) return false;
    return true;
  });

  if (targets.length === 0) {
    console.log(yellow("  No real users found in personas.json to process.\n"));
    return;
  }

  console.log(dim(`  ${targets.length} real user(s) to process\n`));

  let updated = 0;
  let skipped = 0;

  for (const persona of targets) {
    hr();
    console.log(bold(`  ${persona.username}`));

    // Fetch their debate turns from the DB
    const user = await db.user.findUnique({
      where: { username: persona.username },
      select: { id: true },
    });

    if (!user) {
      console.log(dim("    not found in DB — skipping"));
      skipped++;
      continue;
    }

    const turns = await db.debateTurn.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: "asc" },
      include: {
        debate: {
          select: { motion: true, debaterAId: true },
        },
      },
      take: 30, // cap to keep prompt size manageable
    });

    if (turns.length === 0) {
      console.log(dim("    no debate turns yet — skipping"));
      skipped++;
      continue;
    }

    console.log(dim(`    ${turns.length} turn(s) found — inferring...`));

    const turnData = turns.map((t) => ({
      motion: (t as typeof t & { debate: { motion: string; debaterAId: string } }).debate.motion,
      side: (t as typeof t & { debate: { motion: string; debaterAId: string } }).debate.debaterAId === user.id ? "for" as const : "against" as const,
      roundName: t.roundName,
      content: t.content,
    }));

    let inferred: Partial<PersonaEntry>;
    try {
      inferred = await inferProfile(client, persona.username, turnData);
    } catch (err) {
      console.log(yellow(`    ✗ AI inference failed: ${err}`));
      skipped++;
      continue;
    }

    // Merge: only fill null fields, preserve existing data
    let changed = false;
    const idx = personas.findIndex((p) => p.username === persona.username);

    for (const key of ["politicalLeaning", "debateStyle", "prompt"] as const) {
      if (personas[idx][key] === null && inferred[key]) {
        (personas[idx] as unknown as Record<string, unknown>)[key] = inferred[key];
        changed = true;
      }
    }

    for (const key of ["strongTopics", "weakTopics"] as const) {
      if (personas[idx][key].length === 0 && inferred[key]?.length) {
        personas[idx][key] = inferred[key]!;
        changed = true;
      }
    }

    if (personas[idx].writing_style_details === null && inferred.writing_style_details) {
      personas[idx].writing_style_details = inferred.writing_style_details;
      changed = true;
    }

    // Sync bio from DB if blank
    if (personas[idx].bio === null) {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { bio: true },
      });
      if (dbUser?.bio) {
        personas[idx].bio = dbUser.bio;
        changed = true;
      }
    }

    if (changed) {
      console.log(green("    ✓ profile updated"));
      updated++;
    } else {
      console.log(dim("    already fully populated — no changes"));
      skipped++;
    }
  }

  hr();

  if (!dryRun && updated > 0) {
    writeFileSync(personasPath, JSON.stringify(personas, null, 2));
    console.log(green(`\n  Saved. Updated: ${updated}, Skipped: ${skipped}\n`));
  } else {
    console.log(dim(`\n  Done. Updated: ${updated}, Skipped: ${skipped}${dryRun ? " (dry run)" : ""}\n`));
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => db.$disconnect());
