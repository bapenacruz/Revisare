import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import { getTurnSequence, PREP_SECONDS } from "@/lib/debate-state";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Lazily advance phase based on timestamps. Modifies debate in DB if needed. */
async function maybeAdvancePhase(debate: Awaited<ReturnType<typeof fetchDebate>>) {
  if (!debate) return debate;
  const now = new Date();

  // prep → typing
  if (
    debate.phase === "prep" &&
    debate.prepEndsAt &&
    debate.prepEndsAt < now
  ) {
    const updated = await db.debate.update({
      where: { challengeId: debate.challengeId },
      data: { phase: "typing", timerStartedAt: now },
    });
    await pusherTrigger(
      CHANNELS.debate(debate.challengeId),
      EVENTS.DEBATE_STATE_CHANGED,
      { phase: "typing" },
    );
    return { ...debate, ...updated };
  }

  // second_chance expired → forfeit
  if (
    debate.phase === "second_chance" &&
    debate.secondChanceExpiresAt &&
    debate.secondChanceExpiresAt < now
  ) {
    const requesterId = debate.secondChanceRequesterId!;
    const winnerId =
      debate.debaterAId === requesterId ? debate.debaterBId : debate.debaterAId;
    const updated = await db.debate.update({
      where: { challengeId: debate.challengeId },
      data: {
        phase: "completed",
        status: "completed",
        forfeitedBy: requesterId,
        winnerId,
        completedAt: now,
        secondChancePending: false,
      },
    });
    // Update ranked stats
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
    await pusherTrigger(
      CHANNELS.debate(debate.challengeId),
      EVENTS.DEBATE_STATE_CHANGED,
      { phase: "completed", forfeit: true },
    );
    return { ...debate, ...updated };
  }

  return debate;
}

async function fetchDebate(challengeId: string) {
  return db.debate.findUnique({
    where: { challengeId },
    include: {
      debaterA: { select: { id: true, username: true, avatarUrl: true, elo: true } },
      debaterB: { select: { id: true, username: true, avatarUrl: true, elo: true } },
      category: { select: { id: true, label: true, emoji: true, slug: true } },
      turns: { orderBy: { submittedAt: "asc" } },
      judgeResults: true,
      spectatorMessages: { orderBy: { createdAt: "asc" }, take: 60 },
      audienceVotes: { select: { votedForId: true } },
    },
  });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;
  const session = await auth();

  let debate = await fetchDebate(challengeId);
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check visibility: hidden or deleted debates are only accessible to participants and admins
  const userId = session?.user?.id;
  const userRole = (session?.user as { role?: string })?.role;
  const isParticipant = userId && (debate.debaterAId === userId || debate.debaterBId === userId);
  const isAdmin = userRole === "admin";

  if (debate.isDeleted && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (debate.isHidden && !isParticipant && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  debate = await maybeAdvancePhase(debate);

  // Tally audience votes
  const voteTally: Record<string, number> = {};
  for (const v of debate!.audienceVotes) {
    voteTally[v.votedForId] = (voteTally[v.votedForId] ?? 0) + 1;
  }

  // Fetch spectator usernames
  const specUserIds = [
    ...new Set(
      debate!.spectatorMessages
        .filter((m) => m.userId)
        .map((m) => m.userId as string),
    ),
  ];
  const specUsers =
    specUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: specUserIds } },
          select: { id: true, username: true },
        })
      : [];
  const specUserMap = Object.fromEntries(specUsers.map((u) => [u.id, u.username]));

  const spectatorMessages = debate!.spectatorMessages.map((m) => ({
    id: m.id,
    userId: m.userId,
    username: m.userId ? (specUserMap[m.userId] ?? "Unknown") : (m.guestName ?? "Guest"),
    content: m.content,
    createdAt: m.createdAt,
  }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { audienceVotes: _av, spectatorMessages: _sm, ...rest } = debate!;

  return NextResponse.json({
    ...rest,
    spectatorMessages,
    audienceVotes: voteTally,
  });
}
