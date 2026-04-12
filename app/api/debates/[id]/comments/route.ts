import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;

  const debate = await db.debate.findUnique({
    where: { challengeId },
    select: { id: true, status: true },
  });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [comments, spectatorMessages] = await Promise.all([
    db.debateComment.findMany({
      where: { debateId: debate.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    db.spectatorMessage.findMany({
      where: { debateId: debate.id },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
  ]);

  const userIds = [
    ...new Set([
      ...comments.map((c) => c.userId),
      ...spectatorMessages.filter((m) => m.userId).map((m) => m.userId as string),
    ]),
  ];
  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, avatarUrl: true },
        })
      : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const commentItems = comments.map((c) => ({
    id: c.id,
    userId: c.userId,
    username: userMap[c.userId]?.username ?? "Unknown",
    avatarUrl: userMap[c.userId]?.avatarUrl ?? null,
    content: c.content,
    createdAt: c.createdAt,
    isLive: false,
  }));

  const liveItems = spectatorMessages.map((m) => ({
    id: `live-${m.id}`,
    userId: m.userId ?? null,
    username: m.userId
      ? (userMap[m.userId]?.username ?? m.guestName ?? "Guest")
      : (m.guestName ?? "Guest"),
    avatarUrl: m.userId ? (userMap[m.userId]?.avatarUrl ?? null) : null,
    content: m.content,
    createdAt: m.createdAt,
    isLive: true,
  }));

  // Merge chronologically
  const merged = [...commentItems, ...liveItems].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return NextResponse.json(merged);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });
  }

  const debate = await db.debate.findUnique({
    where: { challengeId },
    select: { id: true, status: true },
  });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (debate.status !== "completed") {
    return NextResponse.json({ error: "Comments open after the debate ends." }, { status: 400 });
  }

  const body = await req.json();
  const content: string = (body.content ?? "").trim().slice(0, 1000);
  if (content.length < 2) {
    return NextResponse.json({ error: "Comment too short" }, { status: 400 });
  }

  const comment = await db.debateComment.create({
    data: { debateId: debate.id, userId: session.user.id, content },
  });

  return NextResponse.json({ id: comment.id });
}
