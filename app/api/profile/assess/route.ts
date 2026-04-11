import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      elo: true,
      wins: true,
      losses: true,
      bio: true,
      aiAssessmentUpdatedAt: true,
      favCategories: {
        select: { category: { select: { label: true } } },
      },
      debaterA: {
        where: { status: "completed" },
        take: 4,
        orderBy: { completedAt: "desc" },
        select: {
          motion: true,
          winnerId: true,
          debaterAId: true,
          category: { select: { label: true } },
          turns: {
            where: { userId },
            orderBy: { submittedAt: "asc" },
            take: 2,
            select: { roundName: true, content: true },
          },
        },
      },
      debaterB: {
        where: { status: "completed" },
        take: 4,
        orderBy: { completedAt: "desc" },
        select: {
          motion: true,
          winnerId: true,
          debaterBId: true,
          category: { select: { label: true } },
          turns: {
            where: { userId },
            orderBy: { submittedAt: "asc" },
            take: 2,
            select: { roundName: true, content: true },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Rate-limit: once per week unless force=true
  if (!force && user.aiAssessmentUpdatedAt) {
    const timeSince = Date.now() - user.aiAssessmentUpdatedAt.getTime();
    if (timeSince < SEVEN_DAYS_MS) {
      const nextUpdate = new Date(user.aiAssessmentUpdatedAt.getTime() + SEVEN_DAYS_MS);
      return NextResponse.json(
        { error: `Assessment was recently updated. Next update available: ${nextUpdate.toLocaleDateString()}` },
        { status: 429 }
      );
    }
  }

  const totalDebates = user.wins + user.losses;
  if (totalDebates === 0) {
    return NextResponse.json(
      { error: "You need to complete at least one debate before an assessment can be generated." },
      { status: 400 }
    );
  }

  // Build detailed debate history with actual excerpts
  const allDebates = [
    ...user.debaterA.map((d) => ({
      motion: d.motion,
      category: d.category.label,
      won: d.winnerId === d.debaterAId,
      turns: d.turns,
    })),
    ...user.debaterB.map((d) => ({
      motion: d.motion,
      category: d.category.label,
      won: d.winnerId === d.debaterBId,
      turns: d.turns,
    })),
  ].slice(0, 6);

  const favCategories = user.favCategories.map((fc) => fc.category.label).join(", ") || "various topics";

  const debateHistory = allDebates.length > 0
    ? allDebates.map((d) => {
        const excerpt = d.turns
          .map((t) => `    [${t.roundName}] "${t.content.slice(0, 300)}${t.content.length > 300 ? "…" : ""}"`)
          .join("\n");
        return `- "${d.motion}" (${d.category}) — ${d.won ? "WON" : "LOST"}\n${excerpt}`;
      }).join("\n\n")
    : "No completed debate history available yet.";

  const systemPrompt = `You are an expert debate coach on the platform Revisare. Produce a personalized assessment of this debater.

IMPORTANT: Return ONLY valid JSON matching this exact schema — no markdown, no extra text:
{
  "text": "<assessment text here>",
  "compass": {
    "economic": <number from -1.0 (far left) to 1.0 (far right)>,
    "social": <number from -1.0 (libertarian/bottom) to 1.0 (authoritarian/top)>
  }
}

TEXT REQUIREMENTS:
- 3 short paragraphs, max 350 words total
- Paragraph 1 — Debate style & rhetorical patterns (MUST reference specific motions or quote short phrases from their actual arguments)
- Paragraph 2 — Strengths and blind spots (cite concrete examples from their transcript excerpts — e.g., "In your debate on X you argued Y, which showed...")
- Paragraph 3 — Political/ideological tendencies inferred from the topics they argue and which side they take, plus coaching advice
- Tone: direct, insightful, specific. Zero boilerplate. Do NOT say "Based on your debate history..." or "It seems like..."
- Use the debater's actual words where helpful (short quotes)

COMPASS REQUIREMENTS:
- Infer their economic position from which economic policies/motions they argue for
- Infer their social position from which social/civil liberties positions they take
- If insufficient data, default both to 0.0 with slight random variation ±0.15
- Be intellectually humble — say "leans slightly" rather than claiming certainty`;

  const userMessage = `Debater profile:
Username: ${user.username}
ELO: ${user.elo} | Record: ${user.wins}W–${user.losses}L (${totalDebates} debates) | Win rate: ${Math.round((user.wins / totalDebates) * 100)}%
Favorite categories: ${favCategories}
${user.bio ? `Bio: ${user.bio}` : ""}

Recent debates with argument excerpts:
${debateHistory}`;

  const raw = await aiComplete(systemPrompt, userMessage);

  if (!raw) {
    return NextResponse.json(
      { error: "AI assessment is unavailable right now. Please try again later." },
      { status: 503 }
    );
  }

  // Parse JSON response; fall back to plain text if it fails
  let assessmentText = raw;
  let compassData: { economic: number; social: number } | null = null;

  try {
    const cleaned = stripJsonFences(raw);
    const parsed = JSON.parse(cleaned) as { text?: unknown; compass?: { economic?: unknown; social?: unknown } };
    if (typeof parsed.text === "string") {
      assessmentText = parsed.text;
      if (
        parsed.compass &&
        typeof parsed.compass.economic === "number" &&
        typeof parsed.compass.social === "number"
      ) {
        compassData = {
          economic: Math.max(-1, Math.min(1, parsed.compass.economic)),
          social: Math.max(-1, Math.min(1, parsed.compass.social)),
        };
      }
    }
  } catch {
    // AI didn't return valid JSON — store as plain text, no compass
  }

  // Store structured JSON in aiAssessment field
  const stored = JSON.stringify({ v: 2, text: assessmentText, compass: compassData });

  await db.user.update({
    where: { id: userId },
    data: {
      aiAssessment: stored,
      aiAssessmentUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ assessment: stored });
}
