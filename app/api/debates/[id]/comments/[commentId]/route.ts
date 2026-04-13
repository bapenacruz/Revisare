import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; commentId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id: challengeId, commentId: rawCommentId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const debate = await db.debate.findUnique({
    where: { challengeId },
    select: { id: true },
  });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = (session.user as { role?: string })?.role;

  // Live comments are prefixed with "live-"
  const isLive = rawCommentId.startsWith("live-");
  const commentId = isLive ? rawCommentId.slice(5) : rawCommentId;

  if (!isLive) {
    const comment = await db.debateComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, debateId: true },
    });
    if (!comment || comment.debateId !== debate.id) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (comment.userId !== session.user.id && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await db.debateComment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  }

  // SpectatorMessage
  const spectatorMsg = await db.spectatorMessage.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, debateId: true },
  });
  if (!spectatorMsg || spectatorMsg.debateId !== debate.id) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  if (spectatorMsg.userId !== session.user.id && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await db.spectatorMessage.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
