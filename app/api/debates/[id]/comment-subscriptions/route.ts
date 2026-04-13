import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: check if current user is subscribed
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ subscribed: false });

  const debate = await db.debate.findUnique({ where: { challengeId }, select: { id: true } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sub = await db.debateCommentSubscription.findUnique({
    where: { userId_debateId: { userId: session.user.id, debateId: debate.id } },
    select: { userId: true },
  });

  return NextResponse.json({ subscribed: !!sub });
}

// POST: subscribe
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debate = await db.debate.findUnique({ where: { challengeId }, select: { id: true } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.debateCommentSubscription.upsert({
    where: { userId_debateId: { userId: session.user.id, debateId: debate.id } },
    create: { userId: session.user.id, debateId: debate.id },
    update: {},
  });

  return NextResponse.json({ subscribed: true });
}

// DELETE: unsubscribe
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debate = await db.debate.findUnique({ where: { challengeId }, select: { id: true } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.debateCommentSubscription.deleteMany({
    where: { userId: session.user.id, debateId: debate.id },
  });

  return NextResponse.json({ subscribed: false });
}
