#!/usr/bin/env npx tsx
/**
 * scripts/import-debates.ts
 *
 * Reads lib/data/debates.json and creates all debates in the database,
 * running the full judge panel after each one.
 *
 * Usage:
 *   npx tsx scripts/import-debates.ts
 *   npx tsx scripts/import-debates.ts --dry-run   (validate only, no DB writes)
 */

import { db } from "@/lib/db";
import { getTurnSequence, getRoundTimer } from "@/lib/debate-state";
import { judgeDebate } from "@/lib/judging/run";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config({ path: join(process.cwd(), ".env") });

// ── Persona type (mirrors personas.json entry) ────────────────────────────────
interface PersonaEntry {
  username: string;
  name?: string | null;
  email: string;
  password: string;
  synthetic?: boolean;
  bio?: string | null;
}

// Load personas.json once at startup
const personasPath = join(process.cwd(), "lib", "data", "personas.json");
const allPersonas: PersonaEntry[] = JSON.parse(readFileSync(personasPath, "utf-8"));
const personaMap = new Map(allPersonas.map((p) => [p.username, p]));

/**
 * Ensures a user exists in the DB. If not, creates them from personas.json.
 * Returns the user record or null if neither DB nor personas.json has them.
 */
async function ensureUser(username: string): Promise<{ id: string; username: string } | null> {
  const existing = await db.user.findUnique({ where: { username }, select: { id: true, username: true } });
  if (existing) return existing;

  const persona = personaMap.get(username);
  if (!persona) return null;

  const password = persona.password && persona.password.length >= 8
    ? persona.password
    : "Arguably2026!";

  const hashedPassword = await bcrypt.hash(password, 12);
  const normalizedEmail = persona.email.toLowerCase().trim();

  // Email uniqueness guard (different username might share email via bad data)
  const emailTaken = await db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, username: true } });
  if (emailTaken) return emailTaken;

  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      username,
      hashedPassword,
      bio: persona.bio ?? null,
      isExhibition: persona.synthetic !== false, // AI bots flagged as exhibition
      emailVerified: new Date(),
    },
    select: { id: true, username: true },
  });

  return user;
}

// ── types mirroring debates.json ──────────────────────────────────────────────

interface DebateTurnDef {
  speaker: string;       // username
  round: "opening" | "rebuttal" | "closing";
  content: string;
}

interface DebateDef {
  _comment?: string;
  debaterA: string;      // username — always argues FOR
  debaterB: string;      // username — always argues AGAINST
  motion: string;
  category: string;      // category slug e.g. "economics"
  format: "quick" | "standard";
  ranked: boolean;
  turns: DebateTurnDef[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function bold(s: string)   { return `\x1b[1m${s}\x1b[0m`; }
function green(s: string)  { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function red(s: string)    { return `\x1b[31m${s}\x1b[0m`; }
function dim(s: string)    { return `\x1b[2m${s}\x1b[0m`; }
function hr()              { console.log("─".repeat(60)); }

function validateTurns(def: DebateDef): string[] {
  const errors: string[] = [];
  const expectedRounds =
    def.format === "quick"
      ? ["opening", "opening", "rebuttal", "rebuttal", "closing", "closing"]
      : ["opening", "opening", "rebuttal", "rebuttal", "closing", "closing"];

  if (def.turns.length !== expectedRounds.length) {
    errors.push(
      `Expected ${expectedRounds.length} turns for format "${def.format}", got ${def.turns.length}`
    );
    return errors;
  }

  const speakerCycle = [def.debaterA, def.debaterB, def.debaterA, def.debaterB, def.debaterA, def.debaterB];

  def.turns.forEach((t, i) => {
    if (t.round !== expectedRounds[i]) {
      errors.push(`Turn ${i + 1}: expected round "${expectedRounds[i]}", got "${t.round}"`);
    }
    if (t.speaker !== speakerCycle[i]) {
      errors.push(
        `Turn ${i + 1}: expected speaker "${speakerCycle[i]}", got "${t.speaker}" — debaterA goes first, then alternates`
      );
    }
    if (!t.content || t.content.trim().length < 20) {
      errors.push(`Turn ${i + 1}: content is too short (< 20 chars)`);
    }
  });

  return errors;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log(yellow("\n  DRY RUN — no database writes\n"));

  const filePath = join(process.cwd(), "lib", "data", "debates.json");
  const debates: DebateDef[] = JSON.parse(readFileSync(filePath, "utf-8"));

  console.log(bold(`\n⚔  Revisare — Debate Importer\n`));
  console.log(dim(`  Loading ${debates.length} debate(s) from lib/data/debates.json\n`));
  hr();

  let created = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < debates.length; i++) {
    const def = debates[i];
    console.log(`\n${bold(`[${i + 1}/${debates.length}]`)} ${def.debaterA} vs ${def.debaterB}`);
    console.log(dim(`  "${def.motion}"`));

    // ── Validate ────────────────────────────────────────────────────────────
    const validationErrors = validateTurns(def);
    if (validationErrors.length > 0) {
      console.log(red(`  ✗ Validation failed:`));
      validationErrors.forEach((e) => console.log(red(`    - ${e}`)));
      failed++;
      continue;
    }

    // ── Resolve / onboard users ──────────────────────────────────────────────
    const [userA, userB] = await Promise.all([
      ensureUser(def.debaterA),
      ensureUser(def.debaterB),
    ]);

    if (!userA) { console.log(red(`  ✗ User not found in DB or personas.json: ${def.debaterA}`)); failed++; continue; }
    if (!userB) { console.log(red(`  ✗ User not found in DB or personas.json: ${def.debaterB}`)); failed++; continue; }

    console.log(dim(`  debaterA: ${userA.username} (${userA.id})`));
    console.log(dim(`  debaterB: ${userB.username} (${userB.id})`));

    // ── Duplicate detection ──────────────────────────────────────────────────
    const existingDebate = await db.debate.findFirst({
      where: { motion: def.motion, debaterAId: userA.id, debaterBId: userB.id },
      select: { id: true, winnerId: true },
    });

    if (existingDebate) {
      if (existingDebate.winnerId) {
        console.log(yellow(`  ↩ Already imported and judged — skipping`));
        skipped++;
        continue;
      }
      // Exists but not judged — re-run judge only
      console.log(yellow(`  ↩ Already imported but not judged — re-running judge panel`));
      process.stdout.write(dim("  Running judge panel... "));
      try {
        await judgeDebate(existingDebate.id);
        const updated = await db.debate.findUnique({ where: { id: existingDebate.id }, select: { winnerId: true } });
        const winnerUsername = updated?.winnerId === userA.id ? userA.username : updated?.winnerId === userB.id ? userB.username : "Tie";
        console.log(green(`done`));
        console.log(green(`  ✓ Winner: ${winnerUsername}`));
      } catch (err) {
        console.log(yellow(`(judge failed: ${(err as Error).message})`));
      }
      created++;
      hr();
      continue;
    }

    // ── Resolve category ─────────────────────────────────────────────────────
    const category = await db.category.findUnique({
      where: { slug: def.category },
      select: { id: true, slug: true },
    });

    if (!category) {
      console.log(red(`  ✗ Category not found: "${def.category}"`));
      console.log(dim("    Available slugs: politics, science-tech, philosophy, religion, economics,"));
      console.log(dim("    society, sports, history, environment, culture-entertainment, law-justice, health-lifestyle"));
      failed++;
      continue;
    }

    if (dryRun) {
      console.log(green(`  ✓ Valid (dry run — skipping DB write)`));
      continue;
    }

    // ── Create records ────────────────────────────────────────────────────────
    const challenge = await db.challenge.create({
      data: {
        type: "direct",
        status: "active",
        motion: def.motion,
        categoryId: category.id,
        format: def.format,
        ranked: def.ranked,
        isPublic: true,
        timerPreset: 0,
        creatorId: userA.id,
        targetId: userB.id,
        creatorAccepted: true,
        targetAccepted: true,
        lockedAt: new Date(),
      },
    });

    const debate = await db.debate.create({
      data: {
        challengeId: challenge.id,
        categoryId: category.id,
        motion: def.motion,
        format: def.format,
        ranked: def.ranked,
        isPublic: true,
        timerPreset: getRoundTimer(def.format, "opening"),
        status: "active",
        phase: "typing",
        debaterAId: userA.id,
        debaterBId: userB.id,
        coinFlipWinnerId: userA.id,  // debaterA always goes first from debates.json
        currentTurnIndex: 0,
        currentUserId: userA.id,
        startedAt: new Date(),
      },
    });

    // ── Save turns ────────────────────────────────────────────────────────────
    const turnSequence = getTurnSequence(def.format, userA.id, userA.id, userB.id);

    for (let t = 0; t < def.turns.length; t++) {
      const turn = def.turns[t];
      const speaker = turn.speaker === userA.username ? userA : userB;
      const seq = turnSequence[t];

      await db.debateTurn.create({
        data: {
          debateId: debate.id,
          userId: speaker.id,
          roundName: seq.roundName,
          content: turn.content.trim(),
          submittedAt: new Date(Date.now() + t * 60_000), // stagger timestamps 1 min apart
        },
      });
    }

    // ── Mark completed ────────────────────────────────────────────────────────
    await db.debate.update({
      where: { id: debate.id },
      data: {
        status: "completed",
        phase: "completed",
        currentTurnIndex: def.turns.length,
        currentUserId: null,
        completedAt: new Date(),
      },
    });

    // ── Judge ─────────────────────────────────────────────────────────────────
    process.stdout.write(dim("  Running judge panel... "));
    try {
      await judgeDebate(debate.id);

      const updatedDebate = await db.debate.findUnique({
        where: { id: debate.id },
        select: { winnerId: true },
      });

      const winnerUsername =
        updatedDebate?.winnerId === userA.id
          ? userA.username
          : updatedDebate?.winnerId === userB.id
          ? userB.username
          : "Tie";

      console.log(green(`done`));
      console.log(green(`  ✓ Winner: ${winnerUsername}`));
      console.log(dim(`    Challenge: ${challenge.id} | View: /debates/${challenge.id}/results`));
      created++;
    } catch (err) {
      console.log(yellow(`(judge failed)`));
      console.log(yellow(`  ⚠ Debate saved but judging errored: ${(err as Error).message}`));
      console.log(dim(`    Debate ID: ${debate.id}`));
      created++;
    }

    hr();
  }

  console.log(`\n${bold("Done.")} Created: ${green(String(created))}  Skipped: ${dim(String(skipped))}  Failed: ${failed > 0 ? red(String(failed)) : dim("0")}\n`);
}

main().catch((err) => {
  console.error("\n\x1b[31mFatal error:\x1b[0m", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("\n\x1b[31mUnhandled rejection:\x1b[0m", reason);
  process.exit(1);
});
