import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;

  const debate = await db.debate.findUnique({ where: { challengeId } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.spectatorMessage.findMany({
    where: { debateId: debate.id },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const userIds = [
    ...new Set(messages.filter((m) => m.userId).map((m) => m.userId as string)),
  ];
  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true },
        })
      : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.username]));

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.userId
        ? (userMap[m.userId] ?? "Unknown")
        : (m.guestName ?? "Guest"),
      content: m.content,
      createdAt: m.createdAt,
    })),
  );
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;
  const session = await auth();

  const debate = await db.debate.findUnique({ where: { challengeId } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Public debates allow guest spectators; private debates require auth
  if (!debate.isPublic && !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const content: string = (body.content ?? "").trim().slice(0, 500);
  if (!content) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  // Participants cannot post in spectator chat while debate is active
  if (
    debate.status === "active" &&
    session?.user?.id &&
    (session.user.id === debate.debaterAId || session.user.id === debate.debaterBId)
  ) {
    return NextResponse.json(
      { error: "Participants cannot post in spectator chat during an active debate." },
      { status: 403 },
    );
  }

  const msg = await db.spectatorMessage.create({
    data: {
      debateId: debate.id,
      userId: session?.user?.id ?? null,
      guestName: !session?.user?.id ? (body.guestName ?? "Guest").slice(0, 30) : null,
      content,
    },
  });

  await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.SPECTATOR_MESSAGE, {
    id: msg.id,
    userId: msg.userId,
    username: session?.user
      ? undefined
      : (body.guestName ?? "Guest"),
    content: msg.content,
    createdAt: msg.createdAt,
  });

  return NextResponse.json({ ok: true });
}
