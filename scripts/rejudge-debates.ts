#!/usr/bin/env npx tsx
/**
 * scripts/rejudge-debates.ts
 *
 * Re-runs the full AI judge panel for all completed debates that either:
 *   - Have no judge results at all, OR
 *   - Have judge results missing the new evidenceChecks field, OR
 *   - Are explicitly listed via --ids flag
 *
 * Usage:
 *   npx tsx scripts/rejudge-debates.ts              # re-judge all debates missing new-format results
 *   npx tsx scripts/rejudge-debates.ts --all         # force re-judge every completed debate
 *   npx tsx scripts/rejudge-debates.ts --ids abc,def # re-judge specific debate IDs
 *   npx tsx scripts/rejudge-debates.ts --dry-run     # preview which debates would be re-judged
 */

import { db } from "@/lib/db";
import { runJudgePanel, JUDGE_CONFIGS } from "@/lib/judging/service";
import type { JudgeInput } from "@/lib/judging/types";
import { join } from "path";
import * as dotenv from "dotenv";

// Minimal types to avoid stale-Prisma-client type errors in the TS language server
interface DebateRow {
  id: string;
  motion: string;
  format: string;
  debaterAId: string;
  debaterBId: string;
  coinFlipWinnerId: string | null;
  debaterA: { id: string; username: string };
  debaterB: { id: string; username: string };
  turns: Array<{ userId: string; roundName: string; content: string }>;
  judgeResults: Array<{ id: string; judgeId: string; evidenceChecks: string | null; roundScores: string | null }>;
}

dotenv.config({ path: join(process.cwd(), ".env") });

// ── CLI arg parsing ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const forceAll = args.includes("--all");
const dryRun = args.includes("--dry-run");
const idsFlag = args.find((a) => a.startsWith("--ids="))?.slice(6) ??
  (args[args.indexOf("--ids") + 1] !== undefined &&
  !args[args.indexOf("--ids") + 1]?.startsWith("--")
    ? args[args.indexOf("--ids") + 1]
    : null);
const specificIds = idsFlag ? idsFlag.split(",").map((s) => s.trim()).filter(Boolean) : null;

// ── helpers ───────────────────────────────────────────────────────────────────

function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }
function cyan(s: string) { return `\x1b[36m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function hr() { console.log("─".repeat(70)); }

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  hr();
  console.log(bold("  Arguably — Re-Judge Debates"));
  hr();

  // Fetch all completed debates with their turns and existing results
  let debates = (await db.debate.findMany({
    where: specificIds
      ? { id: { in: specificIds }, status: "completed" }
      : { status: "completed", turns: { some: {} } },
    include: {
      debaterA: { select: { id: true, username: true } },
      debaterB: { select: { id: true, username: true } },
      turns: { orderBy: { submittedAt: "asc" } },
      judgeResults: { select: { id: true, judgeId: true, evidenceChecks: true, roundScores: true } },
    },
    orderBy: { createdAt: "desc" },
  })) as unknown as DebateRow[];

  if (debates.length === 0) {
    console.log(yellow("  No completed debates found."));
    process.exit(0);
  }

  // Filter to debates that need re-judging (unless --all or specific IDs given)
  if (!forceAll && !specificIds) {
    debates = debates.filter((d) => {
      const consensus = d.judgeResults.find((r) => r.judgeId === "consensus");
      // Re-judge if: no results, no consensus, or missing evidenceChecks/scores
      if (!consensus) return true;
      try {
        const checks = consensus.evidenceChecks ? JSON.parse(consensus.evidenceChecks) : [];
        if (!Array.isArray(checks) || checks.length === 0) return true;
        const scores = consensus.roundScores ? JSON.parse(consensus.roundScores) : null;
        if (!scores || Array.isArray(scores) || !scores.scoresA) return true;
        // Re-judge if missing new biggestMistake/Achievement fields
        if (!scores.biggestMistakeA || !scores.biggestAchievementA) return true;
        return false;
      } catch {
        return true;
      }
    });
  }

  if (debates.length === 0) {
    console.log(green("  All debates already have up-to-date judge results. Use --all to force re-judge."));
    process.exit(0);
  }

  console.log(`  Found ${bold(String(debates.length))} debate(s) to re-judge.\n`);

  if (dryRun) {
    console.log(yellow("  DRY RUN — no changes will be made.\n"));
    for (const d of debates) {
      console.log(`  ${cyan(d.id.slice(0, 8))}  "${d.motion.slice(0, 60)}"  ${d.debaterA.username} vs ${d.debaterB.username}`);
    }
    hr();
    process.exit(0);
  }

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < debates.length; i++) {
    const debate = debates[i];
    const prefix = `  [${i + 1}/${debates.length}]`;
    console.log(`${prefix} ${cyan(debate.debaterA.username)} vs ${cyan(debate.debaterB.username)}`);
    console.log(`          "${debate.motion.slice(0, 65)}"`);

    try {
      const input: JudgeInput = {
        motion: debate.motion,
        format: debate.format,
        debaterA: debate.debaterA,
        debaterB: debate.debaterB,
        coinFlipWinnerId: debate.coinFlipWinnerId ?? debate.debaterAId,
        turns: debate.turns.map((t) => ({
          userId: t.userId,
          roundName: t.roundName,
          content: t.content,
        })),
      };

      const consensus = await runJudgePanel(input);

      // Delete ALL existing judge results for this debate before writing new ones
      await db.judgeResult.deleteMany({ where: { debateId: debate.id } });

      // Write individual judge results
      for (let j = 0; j < consensus.judgeVerdicts.length; j++) {
        const v = consensus.judgeVerdicts[j];
        const config = JUDGE_CONFIGS[j];
        await (db.judgeResult.create as Function)({
          data: {
            debateId: debate.id,
            judgeId: config?.id ?? `judge-${j + 1}`,
            winnerId: v.winnerId,
            explanation: v.explanation,
            privateFeedbackA: v.privateFeedbackA,
            privateFeedbackB: v.privateFeedbackB,
            roundScores: JSON.stringify({ scoresA: v.scoresA ?? null, scoresB: v.scoresB ?? null }),
            evidenceChecks: JSON.stringify(v.evidenceChecks ?? []),
          },
        });
      }

      // Write consensus result
      await (db.judgeResult.create as Function)({
        data: {
          debateId: debate.id,
          judgeId: "consensus",
          winnerId: consensus.winnerId,
          explanation: consensus.explanation,
          privateFeedbackA: consensus.privateFeedbackA ?? null,
          privateFeedbackB: consensus.privateFeedbackB ?? null,
          roundScores: JSON.stringify({
            scoresA: consensus.scoresA ?? null,
            scoresB: consensus.scoresB ?? null,
            biggestMistakeA: consensus.biggestMistakeA ?? null,
            biggestAchievementA: consensus.biggestAchievementA ?? null,
            biggestMistakeB: consensus.biggestMistakeB ?? null,
            biggestAchievementB: consensus.biggestAchievementB ?? null,
          }),
          evidenceChecks: JSON.stringify(consensus.evidenceChecks ?? []),
        },
      });

      // Update the debate's official winner
      await db.debate.update({
        where: { id: debate.id },
        data: { winnerId: consensus.winnerId },
      });

      const winnerName =
        consensus.winnerId === debate.debaterAId
          ? debate.debaterA.username
          : consensus.winnerId === debate.debaterBId
            ? debate.debaterB.username
            : "unknown";

      console.log(`          ${green("✓")} Winner: ${bold(winnerName)}  |  Evidence checks: ${consensus.evidenceChecks.length}\n`);
      succeeded++;
    } catch (err) {
      console.log(`          ${red("✗")} Failed: ${err instanceof Error ? err.message : String(err)}\n`);
      failed++;
    }
  }

  hr();
  console.log(`  ${green(`${succeeded} succeeded`)}  ${failed > 0 ? red(`${failed} failed`) : "0 failed"}`);
  hr();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
