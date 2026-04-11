import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { regeneratePrivateFeedback } from "@/lib/judging/run";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/debates/[id]/private-feedback
 * Returns the private feedback for the current participant.
 * If feedback is null, triggers generation and returns { pending: true }.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debate = await db.debate.findUnique({
    where: { challengeId },
    select: {
      id: true,
      status: true,
      debaterAId: true,
      debaterBId: true,
      judgeResults: {
        where: { judgeId: "consensus" },
        select: { privateFeedbackA: true, privateFeedbackB: true },
      },
    },
  });

  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (debate.status !== "completed") {
    return NextResponse.json({ error: "Not completed" }, { status: 400 });
  }

  const isParticipant = userId === debate.debaterAId || userId === debate.debaterBId;
  const isAdmin = role === "admin";
  if (!isParticipant && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const consensus = debate.judgeResults[0];
  const feedbackA = consensus?.privateFeedbackA ?? null;
  const feedbackB = consensus?.privateFeedbackB ?? null;

  const myFeedback =
    userId === debate.debaterAId ? feedbackA :
    userId === debate.debaterBId ? feedbackB :
    null;

  // Feedback exists and looks valid (more than a few chars)
  if (myFeedback && myFeedback.length > 20) {
    return NextResponse.json({ feedback: myFeedback });
  }

  // Feedback is missing — trigger generation (non-blocking) and tell client to retry
  void regeneratePrivateFeedback(debate.id).catch((err) => {
    console.error(`[private-feedback GET] regen failed for ${debate.id}:`, err);
  });

  return NextResponse.json({ pending: true });
}
