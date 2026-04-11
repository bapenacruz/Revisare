import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 25;

  const [flags, total] = await Promise.all([
    db.integrityFlag.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.integrityFlag.count({
      where: status === "all" ? {} : { status },
    }),
  ]);

  // Resolve usernames for userId and reporterId
  const userIds = [
    ...new Set(
      flags.flatMap((f) => [f.userId, f.reporterId].filter(Boolean) as string[]),
    ),
  ];
  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true },
        })
      : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.username]));

  return NextResponse.json({
    flags: flags.map((f) => ({
      ...f,
      flaggedUsername: f.userId ? (userMap[f.userId] ?? f.userId) : null,
      reporterUsername: f.reporterId ? (userMap[f.reporterId] ?? f.reporterId) : null,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
