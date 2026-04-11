import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { judgeDebate } from "@/lib/judging/run";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const debate = await db.debate.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (debate.status !== "completed") {
    return NextResponse.json({ error: "Debate is not completed" }, { status: 400 });
  }

  // Delete existing judge results so judgeDebate can store fresh ones
  await db.judgeResult.deleteMany({ where: { debateId: id } });

  // Fire off judging in background — Railway has a 30s HTTP timeout,
  // the full 3-judge pipeline can take 60–120s, so we return 202 immediately.
  void judgeDebate(id).catch((err) => {
    console.error(`[rejudge] Background judging failed for debate ${id}:`, err);
  });

  return NextResponse.json({ ok: true, message: "Judging started in background. Results will appear in ~60s." });
}
