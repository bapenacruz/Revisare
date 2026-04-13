import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { judgeDebate } from "@/lib/judging";

/**
 * GET /api/cron/judge-pending
 *
 * Finds completed debates that have no AI judge results yet and re-triggers judging.
 * Intended to be called by an external cron service every 5–10 minutes.
 *
 * Secured by CRON_SECRET env var. Pass it as:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Debates completed more than 10 minutes ago with no consensus judge result and not forfeited
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);

  const pending = await db.debate.findMany({
    where: {
      status: "completed",
      isDeleted: false,
      forfeitedBy: null,
      completedAt: { lt: cutoff },
      judgeResults: {
        none: { judgeId: "consensus" },
      },
    },
    select: { id: true, challengeId: true, completedAt: true },
    orderBy: { completedAt: "asc" },
    take: 10, // process at most 10 per run to avoid long request times
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const results: Array<{ id: string; status: "ok" | "error"; error?: string }> = [];

  for (const debate of pending) {
    try {
      await judgeDebate(debate.id);
      results.push({ id: debate.id, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/judge-pending] Failed for debate ${debate.id}:`, err);
      results.push({ id: debate.id, status: "error", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
