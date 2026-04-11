import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { judgeDebate } from "@/lib/judging";

const MIN_WAIT_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const debate = await db.debate.findUnique({
    where: { challengeId },
    select: {
      id: true,
      status: true,
      completedAt: true,
      forfeitedBy: true,
      debaterAId: true,
      debaterBId: true,
      judgeResults: { select: { id: true, judgeId: true } },
    },
  });

  if (!debate) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  if (debate.status !== "completed") {
    return NextResponse.json({ error: "Debate is not completed" }, { status: 400 });
  }

  // Only participants can trigger
  if (userId !== debate.debaterAId && userId !== debate.debaterBId) {
    return NextResponse.json({ error: "Only debate participants can request judging" }, { status: 403 });
  }

  // Check there are no real judge results (ignore stubs/forfeits)
  const realResults = debate.judgeResults.filter(
    (r) => !["stub", "forfeit"].includes(r.judgeId),
  );
  if (realResults.length > 0) {
    return NextResponse.json({ error: "AI judging already exists" }, { status: 409 });
  }

  // Forfeit debates don't need AI judging
  if (debate.forfeitedBy) {
    return NextResponse.json({ error: "Forfeit debates do not require AI judging" }, { status: 400 });
  }

  // Must wait at least 5 min after completion
  if (!debate.completedAt) {
    return NextResponse.json({ error: "completedAt not set" }, { status: 400 });
  }
  const elapsed = Date.now() - new Date(debate.completedAt).getTime();
  if (elapsed < MIN_WAIT_MS) {
    const remainingSec = Math.ceil((MIN_WAIT_MS - elapsed) / 1000);
    return NextResponse.json(
      { error: `Please wait ${remainingSec}s before requesting judging` },
      { status: 429 },
    );
  }

  // Fire judging in background
  void judgeDebate(debate.id).catch((err) => {
    console.error(`[request-judging] Background judging failed for debate ${debate.id}:`, err);
  });

  return NextResponse.json({ ok: true, message: "AI judging triggered. Results will appear shortly." }, { status: 202 });
}
