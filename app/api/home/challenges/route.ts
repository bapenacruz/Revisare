import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 12;

const CHALLENGE_SELECT = {
  id: true,
  type: true,
  motion: true,
  ranked: true,
  format: true,
  status: true,
  creatorId: true,
  targetId: true,
  expiresAt: true,
  createdAt: true,
  creator: { select: { id: true, username: true } },
  target: { select: { id: true, username: true } },
  category: { select: { label: true, emoji: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  // Direct invites are always fetched in full (no pagination — there won't be many)
  const [directInvites, openRows] = await Promise.all([
    db.challenge.findMany({
      where: {
        status: "pending",
        type: "direct",
        targetId: userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      select: CHALLENGE_SELECT,
    }),
    db.challenge.findMany({
      where: {
        status: "pending",
        type: "open",
        // Show all public open challenges except ones the user created
        creatorId: { not: userId },
        isPublic: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: CHALLENGE_SELECT,
    }),
  ]);

  const hasMore = openRows.length > PAGE_SIZE;
  const openItems = hasMore ? openRows.slice(0, PAGE_SIZE) : openRows;

  return NextResponse.json({
    // Direct invites only included on first page (no cursor)
    directInvites: cursor ? [] : directInvites,
    openItems,
    nextCursor: hasMore ? openItems[openItems.length - 1].id : null,
  });
}
