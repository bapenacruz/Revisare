import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);

  // Filters for history
  const filterResult = searchParams.get("result"); // "win" | "loss" | null
  const filterCategory = searchParams.get("category"); // category id or null
  const filterRole = searchParams.get("role"); // "creator" | "participant" | null
  const filterFrom = searchParams.get("from"); // ISO date string
  const filterTo = searchParams.get("to"); // ISO date string

  // Open challenge (pending/locked, created by me, not expired)
  const openChallenge = await db.challenge.findFirst({
    where: {
      creatorId: userId,
      status: { in: ["pending", "locked"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      type: true,
      status: true,
      motion: true,
      format: true,
      ranked: true,
      expiresAt: true,
      createdAt: true,
      category: { select: { id: true, label: true, emoji: true, slug: true } },
      creator: { select: { id: true, username: true } },
      target: { select: { id: true, username: true } },
    },
  });

  // Debate history filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    status: "completed",
    OR: [{ debaterAId: userId }, { debaterBId: userId }],
  };

  if (filterCategory) where.categoryId = filterCategory;
  if (filterFrom || filterTo) {
    where.completedAt = {};
    if (filterFrom) where.completedAt.gte = new Date(filterFrom);
    if (filterTo) where.completedAt.lte = new Date(filterTo);
  }
  if (filterResult === "win") where.winnerId = userId;
  if (filterResult === "loss") {
    where.AND = [
      { winnerId: { not: null } },
      { winnerId: { not: userId } },
    ];
  }
  if (filterRole === "creator") where.challenge = { creatorId: userId };
  if (filterRole === "participant") {
    // participant = was debaterB (joined someone else's challenge)
    where.debaterBId = userId;
  }

  const history = await db.debate.findMany({
    where,
    orderBy: { completedAt: "desc" },
    take: 50,
    select: {
      id: true,
      challengeId: true,
      motion: true,
      ranked: true,
      winnerId: true,
      completedAt: true,
      debaterA: { select: { id: true, username: true } },
      debaterB: { select: { id: true, username: true } },
      category: { select: { id: true, label: true, emoji: true, slug: true } },
    },
  });

  return NextResponse.json({ openChallenge, history });
}
