import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ users: [], debates: [], categories: [] });
  }

  const [users, debates, categories] = await Promise.all([
    db.user.findMany({
      where: {
        isDeleted: false,
        NOT: { email: { endsWith: "@placeholder.com" } },
        OR: [
          { username: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { username: true, avatarUrl: true, elo: true, country: true },
      take: 5,
      orderBy: { elo: "desc" },
    }),
    db.debate.findMany({
      where: {
        isDeleted: false,
        isHidden: false,
        status: "completed",
        motion: { contains: q, mode: "insensitive" },
      },
      select: {
        challengeId: true,
        motion: true,
        category: { select: { label: true, emoji: true } },
        debaterA: { select: { username: true } },
        debaterB: { select: { username: true } },
      },
      take: 5,
      orderBy: { completedAt: "desc" },
    }),
    db.category.findMany({
      where: {
        isActive: true,
        label: { contains: q, mode: "insensitive" },
      },
      select: { slug: true, label: true, emoji: true },
      take: 4,
      orderBy: { order: "asc" },
    }),
  ]);

  return NextResponse.json({ users, debates, categories });
}
