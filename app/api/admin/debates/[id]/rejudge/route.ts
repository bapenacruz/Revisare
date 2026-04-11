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

  // Get current debate data to reverse existing wins/losses if needed
  const debateWithResults = await db.debate.findUnique({
    where: { id },
    select: {
      id: true,
      winnerId: true,
      ranked: true,
      debaterA: { select: { id: true } },
      debaterB: { select: { id: true } },
      judgeResults: { select: { winnerId: true } }
    }
  });

  // If there were existing judge results with a winner, reverse the wins/losses
  if (debateWithResults?.judgeResults && debateWithResults.judgeResults.length > 0 && debateWithResults.winnerId && debateWithResults.ranked) {
    const winnerId = debateWithResults.winnerId;
    const loserId = winnerId === debateWithResults.debaterA.id ? debateWithResults.debaterB.id : debateWithResults.debaterA.id;
    
    // Reverse the existing wins/losses
    await db.$transaction([
      db.user.update({ 
        where: { id: winnerId }, 
        data: { wins: { decrement: 1 } } 
      }),
      db.user.update({ 
        where: { id: loserId }, 
        data: { losses: { decrement: 1 } } 
      }),
    ]);
  }

  // Delete existing judge results so judgeDebate can store fresh ones
  await db.judgeResult.deleteMany({ where: { debateId: id } });

  // Reset winner to null so it gets set fresh by the new judging
  await db.debate.update({
    where: { id },
    data: { winnerId: null }
  });

  // Fire off judging in background — Railway has a 30s HTTP timeout,
  // the full 3-judge pipeline can take 60–120s, so we return 202 immediately.
  void judgeDebate(id).catch((err) => {
    console.error(`[rejudge] Background judging failed for debate ${id}:`, err);
  });

  return NextResponse.json({ ok: true, message: "Judging started in background. Results will appear in ~60s." });
}
