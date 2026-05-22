import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      wins: true,
      losses: true,
      elo: true,
      debaterA: {
        where: { status: "completed", isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          motion: true,
          winnerId: true,
          debaterAId: true,
          turns: {
            where: { userId },
            orderBy: { submittedAt: "asc" },
            select: { roundName: true, content: true },
          },
        },
      },
      debaterB: {
        where: { status: "completed", isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          motion: true,
          winnerId: true,
          debaterAId: true,
          turns: {
            where: { userId },
            orderBy: { submittedAt: "asc" },
            select: { roundName: true, content: true },
          },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const debates = [...user.debaterA, ...user.debaterB];
  if (debates.length === 0) {
    return NextResponse.json({ error: "User has no completed debates to assess" }, { status: 422 });
  }

  // Build a transcript summary for the AI
  const debateSummaries = debates
    .slice(0, 15)
    .map((d) => {
      const won = d.winnerId === userId;
      const turns = d.turns
        .map((t) => `  [${t.roundName.toUpperCase()}]: ${t.content.slice(0, 300)}${t.content.length > 300 ? "…" : ""}`)
        .join("\n");
      return `Motion: "${d.motion}" | Result: ${won ? "WON" : "LOST"}\nTurns:\n${turns}`;
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are an expert debate coach analysing a debater's performance history.
Your task is to write a concise, honest personal assessment of the debater based on their debate transcripts.

Write 3-5 paragraphs covering:
1. Overall debate ability and style
2. Key strengths (argumentation, evidence use, rhetoric)
3. Weaknesses and areas for improvement
4. Notable patterns in topics/positions they argue
5. A brief coaching recommendation

Write in second person ("You tend to…", "Your arguments…"). Be specific and reference actual debate patterns you observe. Keep each paragraph to 2-4 sentences. Do not use markdown headers or bullet points — plain paragraphs only.`;

  const userMsg = `Assess the debate performance of user "${user.username}" (${user.wins}W/${user.losses}L, ELO: ${user.elo}).\n\nDebate history:\n\n${debateSummaries}`;

  const assessment = await aiComplete(systemPrompt, userMsg);
  if (!assessment) {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  await db.user.update({
    where: { id: userId },
    data: { aiAssessment: assessment, aiAssessmentUpdatedAt: new Date() },
  });

  return NextResponse.json({ assessment, updatedAt: new Date() });
}
