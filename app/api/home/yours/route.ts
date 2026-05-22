import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  const rows = await db.debate.findMany({
    where: {
      OR: [{ debaterAId: userId }, { debaterBId: userId }],
      isDeleted: false, // Show hidden debates to participants, but not deleted ones
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      challengeId: true,
      motion: true,
      ranked: true,
      status: true,
      winnerId: true,
      completedAt: true,
      startedAt: true,
      debaterA: { select: { id: true, username: true, avatarUrl: true } },
      debaterB: { select: { id: true, username: true, avatarUrl: true } },
      category: { select: { label: true, emoji: true } },
      audienceVotes: { select: { votedForId: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const rawItems = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const items = rawItems.map(({ audienceVotes, ...rest }) => {
    const tally: Record<string, number> = {};
    for (const v of audienceVotes) tally[v.votedForId] = (tally[v.votedForId] ?? 0) + 1;
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    const audienceLeaderId = total > 0
      ? Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    return { ...rest, audienceLeaderId };
  });

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}
