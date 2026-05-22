import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiComplete } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.motion !== "string" || !body.motion.trim()) {
    return NextResponse.json({ error: "motion is required" }, { status: 400 });
  }

  const rawMotion: string = body.motion.trim();
  const currentCategoryId: string | null = body.categoryId ?? null;

  // Fetch categories from DB so the AI can pick from real data
  const categories = await db.category.findMany({
    select: { id: true, slug: true, label: true },
    orderBy: { label: "asc" },
  });

  if (categories.length === 0) {
    return NextResponse.json({ error: "No categories configured" }, { status: 500 });
  }

  const categoryList = categories.map((c) => `${c.slug}: ${c.label}`).join("\n");

  const systemPrompt = `You are a debate motion editor for a structured debate platform called Revisare.

Your job is to:
1. Rewrite a user's raw description or rough topic into a clean, punchy, debatable motion statement.
2. Pick the most appropriate category for the motion from the provided list.

MOTION RULES:
- Write a clear, declarative statement (e.g. "Social media does more harm than good.")
- Do NOT use "This house believes", "This house would", or any parliamentary phrasing
- Keep it concise — ideally under 15 words
- Make it genuinely arguable (a clear position that can be contested)
- Fix grammar and clarity

CATEGORY RULES:
- Choose the single best matching category slug from the provided list
- If the current category is already a good fit, keep it

RESPONSE FORMAT:
Return ONLY valid JSON with no markdown fences, no extra text. Schema:
{
  "motion": "<refined motion string>",
  "categorySlug": "<best matching category slug>"
}`;

  const userMessage = `User's raw input: ${rawMotion}

Available categories:
${categoryList}

${currentCategoryId ? `Current category id: ${currentCategoryId}` : "No category selected yet."}`;

  const rawResponse = await aiComplete(systemPrompt, userMessage);

  if (!rawResponse) {
    return NextResponse.json({ error: "AI service unavailable. Please try again later." }, { status: 503 });
  }

  // Parse response — strip markdown fences if the model wraps anyway
  let parsed: { motion: string; categorySlug: string } | null = null;
  try {
    const clean = rawResponse.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    return NextResponse.json({ error: "AI returned an unexpected response. Please try again." }, { status: 502 });
  }

  if (!parsed?.motion || !parsed?.categorySlug) {
    return NextResponse.json({ error: "AI returned an incomplete response. Please try again." }, { status: 502 });
  }

  const suggestedCategory = categories.find((c) => c.slug === parsed!.categorySlug);
  if (!suggestedCategory) {
    // AI returned an invalid slug — just return the polished motion without changing category
    return NextResponse.json({
      motion: parsed.motion,
      categoryId: currentCategoryId,
      categoryChanged: false,
      categoryLabel: null,
    });
  }

  const categoryChanged = !!currentCategoryId && suggestedCategory.id !== currentCategoryId;

  return NextResponse.json({
    motion: parsed.motion,
    categoryId: suggestedCategory.id,
    categoryChanged,
    categoryLabel: suggestedCategory.label,
  });
}
