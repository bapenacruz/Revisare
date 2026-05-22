import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  // Get user's favorite categories (if logged in and first page)
  let favCategoryIds: string[] = [];
  if (!cursor) {
    const session = await auth();
    if (session?.user?.id) {
      const favs = await db.userFavoriteCategory.findMany({
        where: { userId: session.user.id },
        select: { categoryId: true },
      });
      favCategoryIds = favs.map((f) => f.categoryId);
    }
  }

  const baseWhere = { status: "completed", isDeleted: false, isHidden: false };

  if (!cursor && favCategoryIds.length > 0) {
    // First page with fav categories: fetch larger batch, sort fav categories first
    const rows = await db.debate.findMany({
      where: baseWhere,
      orderBy: { completedAt: "desc" },
      take: PAGE_SIZE * 3,
      select: {
        id: true,
        challengeId: true,
        motion: true,
        ranked: true,
        winnerId: true,
        completedAt: true,
        categoryId: true,
        viewCount: true,
        debaterA: { select: { id: true, username: true, avatarUrl: true } },
        debaterB: { select: { id: true, username: true, avatarUrl: true } },
        category: { select: { label: true, emoji: true } },
        audienceVotes: { select: { votedForId: true } },
        _count: { select: { debateComments: true } },
      },
    });

    // Sort: fav categories first (maintaining recency within each group)
    const favSet = new Set(favCategoryIds);
    rows.sort((a, b) => {
      const aFav = favSet.has(a.categoryId) ? 0 : 1;
      const bFav = favSet.has(b.categoryId) ? 0 : 1;
      return aFav - bFav;
    });

    const pageRows = rows.slice(0, PAGE_SIZE + 1);
    const hasMore = pageRows.length > PAGE_SIZE;
    const rawItems = hasMore ? pageRows.slice(0, PAGE_SIZE) : pageRows;

    const items = rawItems.map(({ audienceVotes, categoryId: _cid, _count, ...rest }) => {
      const tally: Record<string, number> = {};
      for (const v of audienceVotes) tally[v.votedForId] = (tally[v.votedForId] ?? 0) + 1;
      const total = Object.values(tally).reduce((a, b) => a + b, 0);
      const audienceLeaderId = total > 0
        ? Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
        : null;
      return { ...rest, audienceLeaderId, commentCount: _count.debateComments, voteCount: total };
    });

    return NextResponse.json({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  }

  // Normal pagination (no fav preference or subsequent pages)
  const rows = await db.debate.findMany({
    where: baseWhere,
    orderBy: { completedAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      challengeId: true,
      motion: true,
      ranked: true,
      winnerId: true,
      completedAt: true,
      viewCount: true,
      debaterA: { select: { id: true, username: true, avatarUrl: true } },
      debaterB: { select: { id: true, username: true, avatarUrl: true } },
      category: { select: { label: true, emoji: true } },
      audienceVotes: { select: { votedForId: true } },
      _count: { select: { debateComments: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const rawItems = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const items = rawItems.map(({ audienceVotes, _count, ...rest }) => {
    const tally: Record<string, number> = {};
    for (const v of audienceVotes) tally[v.votedForId] = (tally[v.votedForId] ?? 0) + 1;
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    const audienceLeaderId = total > 0
      ? Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    return { ...rest, audienceLeaderId, commentCount: _count.debateComments, voteCount: total };
  });

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}
