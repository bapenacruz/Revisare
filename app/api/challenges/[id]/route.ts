import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: {
      category: { select: { id: true, label: true, emoji: true, slug: true } },
      creator: { select: { id: true, username: true, avatarUrl: true } },
      target: { select: { id: true, username: true, avatarUrl: true } },
      joinRequests: {
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 1,
        include: {
              user: { select: { id: true, username: true, avatarUrl: true, elo: true, wins: true, losses: true, country: true } },
        },
      },
    },
  });

  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isParticipant =
    challenge.creatorId === session.user.id ||
    challenge.targetId === session.user.id;

  // Pending challenges are publicly viewable by any authenticated user so they can accept/join.
  // Once locked or active, restrict to participants only.
  if (!isParticipant && challenge.status !== "pending") {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // Only expose join requests to the creator
  const response = {
    ...challenge,
    joinRequests: challenge.creatorId === session.user.id ? challenge.joinRequests : [],
  };

  return NextResponse.json(response);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, creatorId: true, status: true },
  });

  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (challenge.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Only the creator can delete this challenge." }, { status: 403 });
  }
  if (challenge.status === "active") {
    return NextResponse.json({ error: "Cannot delete an active debate." }, { status: 400 });
  }

  await db.challenge.delete({ where: { id: challengeId } });
  return NextResponse.json({ success: true });
}
