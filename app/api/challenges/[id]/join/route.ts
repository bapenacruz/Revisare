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

  if (challenge.type !== "open") {
    return NextResponse.json({ error: "This challenge is not open" }, { status: 400 });
  }

  if (challenge.targetId) {
    return NextResponse.json({ error: "Challenge already has an opponent" }, { status: 409 });
  }

  if (challenge.status !== "pending") {
    return NextResponse.json({ error: "Challenge is no longer open" }, { status: 400 });
  }

  if (challenge.creatorId === session.user.id) {
    return NextResponse.json({ error: "You cannot join your own challenge" }, { status: 400 });
  }

  // Check if there is already a pending request from this user
  const existing = await db.joinRequest.findFirst({
    where: { challengeId, userId: session.user.id, status: "pending" },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a pending request" }, { status: 409 });
  }

  // Fetch the requester's public profile for the owner popup
  const requester = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, avatarUrl: true, elo: true, wins: true, losses: true, country: true },
  });

  // Create the join request
  const joinRequest = await db.joinRequest.create({
    data: { challengeId, userId: session.user.id, status: "pending" },
    include: { user: { select: { id: true, username: true, avatarUrl: true, elo: true, wins: true, losses: true, country: true } } },
  });

  // Notify the creator in real-time and via notification centre
  await pusherTrigger(CHANNELS.lobby(challengeId), EVENTS.LOBBY_JOIN_REQUEST, {
    requestId: joinRequest.id,
    user: requester,
  });

  await createNotification(challenge.creatorId, {
    type: "challenge_accepted",
    title: `${requester?.username ?? "Someone"} wants to join!`,
    body: "A player wants to join your open challenge. Visit the lobby to accept or decline.",
    href: `/challenges/${challengeId}/lobby`,
    challengeId,
  });

  return NextResponse.json({ requested: true, requestId: joinRequest.id });
}
