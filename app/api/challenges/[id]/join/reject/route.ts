import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (challenge.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Only the challenge owner can reject" }, { status: 403 });
  }

  let body: { requestId?: string } = {};
  try { body = await request.json(); } catch { /* no body */ }

  const joinRequest = await db.joinRequest.findFirst({
    where: {
      challengeId,
      status: "pending",
      ...(body.requestId ? { id: body.requestId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (!joinRequest) {
    return NextResponse.json({ error: "No pending join request found" }, { status: 404 });
  }

  await db.joinRequest.update({
    where: { id: joinRequest.id },
    data: { status: "rejected" },
  });

  await createNotification(joinRequest.userId, {
    type: "challenge_accepted",
    title: "Request declined",
    body: "The challenge owner declined your request to join.",
    href: `/challenges/${challengeId}/lobby`,
    challengeId,
  });

  return NextResponse.json({ rejected: true });
}
