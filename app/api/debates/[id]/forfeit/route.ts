import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import { createNotification } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const debate = await db.debate.findUnique({ where: { challengeId } });
  if (!debate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = session.user.id;
  if (userId !== debate.debaterAId && userId !== debate.debaterBId) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }
  if (debate.phase === "completed") {
    return NextResponse.json({ error: "Debate already completed" }, { status: 400 });
  }

  const opponentId = debate.debaterAId === userId ? debate.debaterBId : debate.debaterAId;
  const now = new Date();

  await db.debate.update({
    where: { challengeId },
    data: {
      phase: "completed",
      status: "completed",
      forfeitedBy: userId,
      winnerId: opponentId,
      completedAt: now,
    },
  });

  if (debate.ranked) {
    await db.user.update({
      where: { id: opponentId },
      data: { wins: { increment: 1 }, elo: { increment: 25 } },
    });
    await db.user.update({
      where: { id: userId },
      data: { losses: { increment: 1 }, elo: { decrement: 25 } },
    });
  }

  await db.judgeResult.create({
    data: {
      debateId: debate.id,
      judgeId: "forfeit",
      winnerId: opponentId,
      explanation: "This debate ended by forfeit. The win has been awarded to the opponent.",
      privateFeedbackA: null,
      privateFeedbackB: null,
      roundScores: "[]",
    },
  }).catch(() => undefined);

  await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, {
    phase: "completed",
    forfeit: true,
  });

  const forfeiter = await db.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  if (opponentId) {
    await createNotification(opponentId, {
      type: "opponent_forfeit",
      title: "Your opponent forfeited",
      body: `${forfeiter?.username ?? "Your opponent"} forfeited the debate. You win!`,
      href: `/debates/${debate.id}/results`,
    });
  }

  return NextResponse.json({ success: true });
}
