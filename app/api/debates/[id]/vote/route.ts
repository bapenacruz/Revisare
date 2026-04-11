import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: challengeId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  }

  const debate = await db.debate.findUnique({ where: { challengeId } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (debate.status !== "completed") {
    return NextResponse.json({ error: "Voting opens after the debate ends." }, { status: 400 });
  }

  const body = await req.json();
  const { votedForId, voterToken }: { votedForId: string; voterToken: string } = body;

  if (!votedForId || !voterToken) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (votedForId !== debate.debaterAId && votedForId !== debate.debaterBId) {
    return NextResponse.json({ error: "Invalid votedForId" }, { status: 400 });
  }

  // Debaters cannot vote in their own debate
  if (session?.user?.id && (session.user.id === debate.debaterAId || session.user.id === debate.debaterBId)) {
    return NextResponse.json({ error: "Participants cannot vote in their own debate." }, { status: 403 });
  }

  // Auth'd users: enforce token = userId to prevent spoofing
  const resolvedToken =
    session?.user?.id ? session.user.id : voterToken.slice(0, 64);

  const existing = await db.audienceVote.findUnique({
    where: { debateId_voterToken: { debateId: debate.id, voterToken: resolvedToken } },
  });

  if (existing?.votedForId === votedForId) {
    // Clicking the same debater again — remove vote (toggle off)
    await db.audienceVote.delete({
      where: { debateId_voterToken: { debateId: debate.id, voterToken: resolvedToken } },
    });
    const votes = await db.audienceVote.findMany({ where: { debateId: debate.id }, select: { votedForId: true } });
    const tally: Record<string, number> = {};
    for (const v of votes) tally[v.votedForId] = (tally[v.votedForId] ?? 0) + 1;
    return NextResponse.json({ tally, removed: true });
  }

  try {
    await db.audienceVote.upsert({
      where: { debateId_voterToken: { debateId: debate.id, voterToken: resolvedToken } },
      create: { debateId: debate.id, voterToken: resolvedToken, votedForId },
      update: { votedForId },
    });
  } catch {
    return NextResponse.json({ error: "Vote failed" }, { status: 500 });
  }

  // Return updated tally
  const votes = await db.audienceVote.findMany({
    where: { debateId: debate.id },
    select: { votedForId: true },
  });
  const tally: Record<string, number> = {};
  for (const v of votes) {
    tally[v.votedForId] = (tally[v.votedForId] ?? 0) + 1;
  }

  return NextResponse.json({ tally });
}
