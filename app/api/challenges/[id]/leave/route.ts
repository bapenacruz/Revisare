import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import { createNotification } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (challenge.status === "locked" || challenge.status === "active") {
    return NextResponse.json({ error: "Cannot leave a debate that has already started" }, { status: 400 });
  }

  const isCreator = challenge.creatorId === session.user.id;
  const isTarget = challenge.targetId === session.user.id;

  if (!isCreator && !isTarget) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  if (isTarget) {
    // Target leaves — reset challenge to open, no target
    await db.challenge.update({
      where: { id: challengeId },
      data: { targetId: null, targetAccepted: false },
    });

    await pusherTrigger(CHANNELS.lobby(challengeId), EVENTS.LOBBY_TERMS_ACCEPTED, {
      userId: null,
    });

    await createNotification(challenge.creatorId, {
      type: "challenge_accepted",
      title: "Opponent left the lobby",
      body: "Your opponent left. The challenge is open again.",
      href: `/challenges/${challengeId}/lobby`,
      challengeId,
    });

    return NextResponse.json({ left: true, cancelled: false });
  }

  // Creator leaves
  if (challenge.targetId) {
    // Promote target to creator
    await db.challenge.update({
      where: { id: challengeId },
      data: {
        creatorId: challenge.targetId,
        targetId: null,
        creatorAccepted: false,
        targetAccepted: false,
      },
    });

    await pusherTrigger(CHANNELS.lobby(challengeId), EVENTS.LOBBY_TERMS_ACCEPTED, {
      userId: null,
    });

    await createNotification(challenge.targetId, {
      type: "challenge_accepted",
      title: "You are now the host",
      body: "The original creator left. You are now the host of this challenge.",
      href: `/challenges/${challengeId}/lobby`,
      challengeId,
    });

    return NextResponse.json({ left: true, cancelled: false });
  }

  // Creator leaves with no target — cancel the challenge
  await db.challenge.delete({ where: { id: challengeId } });

  return NextResponse.json({ left: true, cancelled: true });
}
