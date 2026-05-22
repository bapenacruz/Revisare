import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai";
import { DEFAULT_ASSESSMENT_SYSTEM_PROMPT } from "@/lib/judging/assessment-prompt";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Categories that carry strong ideological signal
const IDEOLOGICAL_CATEGORIES = new Set([
  "politics", "economics", "law", "ethics", "culture", "religion", "society", "immigration",
  "environment", "government", "rights", "justice",
]);

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function computeConfidence(debateCount: number, ideologicalCategoryCount: number): {
  level: "very_low" | "low" | "moderate" | "high";
  label: string;
  compressionFactor: number; // 0–1: how much to compress coordinates toward center
} {
  if (debateCount <= 2) return { level: "very_low", label: "Very Low", compressionFactor: 0.25 };
  if (debateCount <= 5) return { level: "low", label: "Low", compressionFactor: 0.5 };
  if (debateCount <= 9 || ideologicalCategoryCount < 3) return { level: "moderate", label: "Moderate", compressionFactor: 0.75 };
  return { level: "high", label: "High", compressionFactor: 1.0 };
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
        take: 6,
        orderBy: { completedAt: "desc" },
        select: {
          motion: true,
          winnerId: true,
          debaterAId: true,
          ranked: true,
          category: { select: { label: true, slug: true } },
          turns: {
            where: { userId },
            orderBy: { submittedAt: "asc" },
            take: 3,
            select: { roundName: true, content: true },
          },
        },
      },
      debaterB: {
        where: { status: "completed" },
        take: 6,
        orderBy: { completedAt: "desc" },
        select: {
          motion: true,
          winnerId: true,
          debaterBId: true,
          ranked: true,
          category: { select: { label: true, slug: true } },
          turns: {
            where: { userId },
            orderBy: { submittedAt: "asc" },
            take: 3,
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

  // Build debate list
  const allDebates = [
    ...user.debaterA.map((d) => ({
      motion: d.motion,
      category: d.category.label,
      categorySlug: d.category.slug,
      won: d.winnerId === d.debaterAId,
      ranked: d.ranked,
      turns: d.turns,
    })),
    ...user.debaterB.map((d) => ({
      motion: d.motion,
      category: d.category.label,
      categorySlug: d.category.slug,
      won: d.winnerId === d.debaterBId,
      ranked: d.ranked,
      turns: d.turns,
    })),
  ].slice(0, 8);

  // Count ideologically meaningful categories
  const seenIdeologicalCategories = new Set(
    allDebates
      .filter((d) => IDEOLOGICAL_CATEGORIES.has(d.categorySlug?.toLowerCase() ?? d.category.toLowerCase()))
      .map((d) => d.category)
  );

  const confidence = computeConfidence(allDebates.length, seenIdeologicalCategories.size);

  const favCategories = user.favCategories.map((fc) => fc.category.label).join(", ") || "various topics";

  // Load custom assessment prompt from DB, falling back to default
  const customPromptRecord = await db.judgePrompt.findFirst({ where: { type: "assessment_prompt" } });
  const basePrompt = customPromptRecord?.prompt ?? DEFAULT_ASSESSMENT_SYSTEM_PROMPT;

  const confidenceBlock = `\nCONFIDENCE LEVEL: ${confidence.label} (${allDebates.length} debates, ${seenIdeologicalCategories.size} ideological categories)\n- Compress coordinates toward center proportionally. At Very Low confidence, max coordinate magnitude = 0.25. At Low = 0.5. At Moderate = 0.75.\n- With low confidence: soften labels further, mention more debates needed`;

  const debateHistory = allDebates.length > 0
    ? allDebates.map((d) => {
        const excerpt = d.turns
          .map((t) => `    [${t.roundName}] "${t.content.slice(0, 350)}${t.content.length > 350 ? "..." : ""}"`)
          .join("\n");
        return `- "${d.motion}" (${d.category}) — ${d.won ? "WON" : "LOST"}\n${excerpt}`;
      }).join("\n\n")
    : "No completed debate history available yet.";

  const systemPrompt = `${basePrompt}${confidenceBlock}`;

  const userMessage = `Debater: ${user.username}
ELO: ${user.elo} | Record: ${user.wins}W–${user.losses}L (${totalDebates} completed) | Win rate: ${Math.round((user.wins / totalDebates) * 100)}%
Favorite categories: ${favCategories}
${user.bio ? `Bio: "${user.bio}"` : ""}
Ideological categories covered: ${seenIdeologicalCategories.size > 0 ? [...seenIdeologicalCategories].join(", ") : "none yet"}

Recent debates with argument excerpts:
${debateHistory}`;

  const raw = await aiComplete(systemPrompt, userMessage);

  if (!raw) {
    return NextResponse.json(
      { error: "AI assessment is unavailable right now. Please try again later." },
      { status: 503 }
    );
  }

  // Parse response
  let argumentStyle = "";
  let ideologicalTendency = "";
  let confidenceNote = "";
  let compassLabel = "";
  let compassData: { economic: number; social: number } | null = null;

  try {
    const cleaned = stripJsonFences(raw);
    const parsed = JSON.parse(cleaned) as {
      argumentStyle?: unknown;
      ideologicalTendency?: unknown;
      confidenceNote?: unknown;
      compassLabel?: unknown;
      compass?: { economic?: unknown; social?: unknown };
    };

    argumentStyle = typeof parsed.argumentStyle === "string" ? parsed.argumentStyle : "";
    ideologicalTendency = typeof parsed.ideologicalTendency === "string" ? parsed.ideologicalTendency : "";
    confidenceNote = typeof parsed.confidenceNote === "string" ? parsed.confidenceNote : "";
    compassLabel = typeof parsed.compassLabel === "string" ? parsed.compassLabel : "";

    if (
      parsed.compass &&
      typeof parsed.compass.economic === "number" &&
      typeof parsed.compass.social === "number"
    ) {
      // Clamp to [-1, 1] then apply confidence compression
      const rawEco = Math.max(-1, Math.min(1, parsed.compass.economic));
      const rawSoc = Math.max(-1, Math.min(1, parsed.compass.social));
      const f = confidence.compressionFactor;
      compassData = {
        economic: rawEco * f,
        social: rawSoc * f,
      };
    }
  } catch {
    // Fall back: store raw text
    argumentStyle = raw;
  }

  const stored = JSON.stringify({
    v: 3,
    argumentStyle,
    ideologicalTendency,
    confidenceNote,
    compassLabel,
    confidenceLevel: confidence.label,
    compass: compassData,
  });

  await db.user.update({
    where: { id: userId },
    data: {
      aiAssessment: stored,
      aiAssessmentUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ assessment: stored });
}
