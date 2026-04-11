import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import { PREP_SECONDS, getRoundTimer } from "@/lib/debate-state";
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
    return NextResponse.json({ error: "Already locked" }, { status: 400 });
  }

  const isCreator = challenge.creatorId === session.user.id;
  const isTarget = challenge.targetId === session.user.id;
  if (!isCreator && !isTarget) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const updates: Record<string, boolean | Date> = {};
  if (isCreator) updates.creatorAccepted = true;
  if (isTarget) updates.targetAccepted = true;

  const updated = await db.challenge.update({
    where: { id: challengeId },
    data: updates,
  });

  // Notify other participant via Pusher
  await pusherTrigger(CHANNELS.lobby(challengeId), EVENTS.LOBBY_TERMS_ACCEPTED, {
    userId: session.user.id,
  });

  // Notify the other party that terms were accepted
  const otherId = isCreator ? challenge.targetId : challenge.creatorId;
  if (otherId) {
    await createNotification(otherId, {
      type: "challenge_accepted",
      title: "Terms accepted",
      body: "A participant has accepted the debate terms. Waiting for both sides...",
      href: `/challenges/${challengeId}/lobby`,
      challengeId,
    });
  }

  // Both accepted — create Debate and set challenge to active
  if (updated.creatorAccepted && updated.targetAccepted) {
    // Guard against concurrent creation
    const existing = await db.debate.findUnique({ where: { challengeId } });

    const debaterAId = challenge.creatorId;
    const debaterBId = challenge.targetId!;

    if (!existing) {
      const coinFlipWinnerId = debaterAId; // debaterA (creator) always goes first as proposition

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
          coinFlipWinnerId,
          currentUserId: coinFlipWinnerId,
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

    // Notify both debaters that the debate is starting
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
        body: "Both sides have accepted. Head to the arena to begin.",
        href: debateHref,
        challengeId,
      }),
    ]);

    return NextResponse.json({ status: "active" });
  }

  return NextResponse.json({
    status: "pending",
    creatorAccepted: updated.creatorAccepted,
    targetAccepted: updated.targetAccepted,
  });
}
