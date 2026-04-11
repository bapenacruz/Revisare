import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;
  const { action }: { action: "approve" | "deny" } = await req.json();

  const debate = await db.debate.findUnique({ where: { challengeId } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (debate.phase !== "second_chance" || !debate.secondChancePending) {
    return NextResponse.json({ error: "No pending second-chance request" }, { status: 400 });
  }

  // Must be the opponent (not the requester)
  const isParticipant =
    session.user.id === debate.debaterAId || session.user.id === debate.debaterBId;
  const isRequester = session.user.id === debate.secondChanceRequesterId;
  if (!isParticipant || isRequester) {
    return NextResponse.json({ error: "Only the opponent can respond" }, { status: 403 });
  }

  // Check expiry
  if (debate.secondChanceExpiresAt && debate.secondChanceExpiresAt < new Date()) {
    return NextResponse.json({ error: "Second-chance window has expired" }, { status: 400 });
  }

  const requesterId = debate.secondChanceRequesterId!;
  const now = new Date();

  if (action === "approve") {
    await db.debate.update({
      where: { challengeId },
      data: {
        phase: "typing",
        secondChancePending: false,
        secondChanceRequesterId: null,
        secondChanceExpiresAt: null,
        // Mark that this user has now used their one second chance
        secondChanceUserId: requesterId,
        timerStartedAt: now,
      },
    });
    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, {
      phase: "typing",
      secondChanceApproved: true,
    });
    return NextResponse.json({ phase: "typing" });
  }

  // deny → forfeit requester
  const winnerId =
    debate.debaterAId === requesterId ? debate.debaterBId : debate.debaterAId;

  await db.debate.update({
    where: { challengeId },
    data: {
      phase: "completed",
      status: "completed",
      forfeitedBy: requesterId,
      winnerId,
      completedAt: now,
      secondChancePending: false,
    },
  });

  if (debate.ranked) {
    await db.user.update({
      where: { id: winnerId },
      data: { wins: { increment: 1 }, elo: { increment: 25 } },
    });
    await db.user.update({
      where: { id: requesterId },
      data: { losses: { increment: 1 }, elo: { decrement: 25 } },
    });
  }

  await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, {
    phase: "completed",
    forfeit: true,
  });

  return NextResponse.json({ phase: "completed", forfeit: true });
}
