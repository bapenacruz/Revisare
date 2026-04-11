import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const messageSchema = z.object({
  content: z.string().min(1).max(500),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only participants may chat
  const isParticipant =
    challenge.creatorId === session.user.id ||
    challenge.targetId === session.user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  if (challenge.status === "locked" || challenge.status === "active") {
    return NextResponse.json({ error: "Lobby is locked" }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const message = await db.lobbyChatMessage.create({
    data: {
      challengeId,
      userId: session.user.id,
      content: parsed.data.content.trim(),
    },
    include: { challenge: false },
  });

  // Ping Pusher (no-op if keys absent)
  await pusherTrigger(CHANNELS.lobby(challengeId), EVENTS.LOBBY_MESSAGE, {
    id: message.id,
    userId: session.user.id,
    content: message.content,
    createdAt: message.createdAt,
  });

  return NextResponse.json(message, { status: 201 });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isParticipant =
    challenge.creatorId === session.user.id ||
    challenge.targetId === session.user.id;
  // Allow any authenticated user to read lobby chat for pending challenges
  if (!isParticipant && challenge.status !== "pending") {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const messages = await db.lobbyChatMessage.findMany({
    where: { challengeId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}
