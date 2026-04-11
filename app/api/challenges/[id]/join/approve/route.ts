import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
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

  // Assign the joiner as the target
  await db.challenge.update({
    where: { id: challengeId },
    data: { targetId: joinRequest.userId, targetAccepted: false },
  });

  await pusherTrigger(CHANNELS.lobby(challengeId), EVENTS.LOBBY_TERMS_ACCEPTED, {
    userId: joinRequest.userId,
  });

  await createNotification(joinRequest.userId, {
    type: "challenge_accepted",
    title: "Your request was accepted!",
    body: "The challenge owner accepted you. Head to the lobby to confirm the terms.",
    href: `/challenges/${challengeId}/lobby`,
    challengeId,
  });

  return NextResponse.json({ approved: true });
}
