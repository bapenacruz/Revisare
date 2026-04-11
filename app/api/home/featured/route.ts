import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  const rows = await db.debate.findMany({
    where: { 
      status: "completed",
      isDeleted: false,
      isHidden: false
    },
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
      debaterA: { select: { id: true, username: true } },
      debaterB: { select: { id: true, username: true } },
      category: { select: { label: true, emoji: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}
