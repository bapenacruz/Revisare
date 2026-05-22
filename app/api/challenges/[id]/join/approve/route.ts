import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import { PREP_SECONDS, getRoundTimer } from "@/lib/debate-state";
import { createNotification } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (challenge.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Only the challenge owner can approve" }, { status: 403 });
  }

  if (challenge.targetId) {
    return NextResponse.json({ error: "Challenge already has an opponent" }, { status: 409 });
  }

  let body: { requestId?: string } = {};
  try { body = await request.json(); } catch { /* no body */ }

  // Find the join request — specific one if requestId supplied, else the oldest pending one
  const joinRequest = await db.joinRequest.findFirst({
    where: {
      challengeId,
      status: "pending",
      ...(body.requestId ? { id: body.requestId } : {}),
    },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (!joinRequest) {
    return NextResponse.json({ error: "No pending join request found" }, { status: 404 });
  }

  // Mark approved, reject all others for this challenge
  await db.joinRequest.updateMany({
    where: { challengeId, status: "pending" },
    data: { status: "rejected" },
  });
  await db.joinRequest.update({
    where: { id: joinRequest.id },
    data: { status: "approved" },
  });

  // Assign the joiner as the target and auto-accept both sides
  // (creator consented by approving; joiner consented by joining)
  await db.challenge.update({
    where: { id: challengeId },
    data: { targetId: joinRequest.userId, creatorAccepted: true, targetAccepted: true },
  });

  await pusherTrigger(CHANNELS.lobby(challengeId), EVENTS.LOBBY_TERMS_ACCEPTED, {
    userId: joinRequest.userId,
  });

  // Guard against concurrent debate creation
  const existing = await db.debate.findUnique({ where: { challengeId } });

  const debaterAId = challenge.creatorId;
  const debaterBId = joinRequest.userId;

  if (!existing) {
    const now = new Date();
    const prepEndsAt = new Date(now.getTime() + PREP_SECONDS * 1000);

    await db.debate.create({
      data: {
        challengeId,
        categoryId: challenge.categoryId,
        motion: challenge.motion,
        format: challenge.format,
        ranked: challenge.ranked,
        isPublic: challenge.isPublic,
        timerPreset: getRoundTimer(challenge.format, "opening"),
        debaterAId,
        debaterBId,
        status: "active",
        phase: "prep",
        coinFlipWinnerId: debaterAId,
        currentUserId: debaterAId,
        currentTurnIndex: 0,
        prepEndsAt,
        startedAt: now,
      },
    });
  }

  await db.challenge.update({
    where: { id: challengeId },
    data: { status: "active", lockedAt: new Date() },
  });

  await pusherTrigger(CHANNELS.lobby(challengeId), EVENTS.LOBBY_LOCKED, {
    lockedAt: new Date(),
  });

  const debateHref = `/debates/${challengeId}`;
  await Promise.all([
    createNotification(debaterAId, {
      type: "debate_starting",
      title: "Your debate is starting!",
      body: "Both sides have accepted. Head to the arena to begin.",
      href: debateHref,
      challengeId,
    }),
    createNotification(debaterBId, {
      type: "debate_starting",
      title: "Your debate is starting!",
      body: "You joined and the debate is starting. Head to the arena to begin.",
      href: debateHref,
      challengeId,
    }),
  ]);

  return NextResponse.json({ approved: true });
}
