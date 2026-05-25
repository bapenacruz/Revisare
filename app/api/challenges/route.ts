import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateMotion } from "@/lib/topic-validator";
import { createNotification } from "@/lib/notifications";
import { PREP_SECONDS, getRoundTimer } from "@/lib/debate-state";
import { AI_OPPONENT_USER_ID, AI_OPPONENT_USERNAME } from "@/lib/ai-opponent";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["open", "direct", "ai"]),
  motion: z.string().min(10).max(280),
  categoryId: z.string().min(1),
  format: z.enum(["quick", "standard"]),
  ranked: z.boolean(),
  isPublic: z.boolean(),
  isPractice: z.boolean().optional(),
  targetUsername: z.string().optional(), // for direct challenges
});

/** Look up or lazily create the AI opponent system account. */
async function getOrCreateAiUser() {
  const existing = await db.user.findUnique({ where: { id: AI_OPPONENT_USER_ID } });
  if (existing) return existing;
  return db.user.create({
    data: {
      id: AI_OPPONENT_USER_ID,
      username: AI_OPPONENT_USERNAME,
      email: "ai@system.revisare.internal",
      role: "system",
      onboardingComplete: true,
      isExhibition: true,
      hideFromLeaderboard: true,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;

  // Practice mode: always unranked + private
  const isPractice = data.isPractice === true || data.type === "ai";
  const ranked = isPractice ? false : true;   // normal = always ranked
  const isPublic = isPractice ? false : true; // normal = always public

  // Validate motion
  const motionError = validateMotion(data.motion);
  if (motionError) {
    return NextResponse.json({ error: motionError }, { status: 400 });
  }

  // Validate category exists
  const category = await db.category.findUnique({ where: { id: data.categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 400 });
  }

  // Enforce: 1 open debate at a time
  const existing = await db.challenge.findFirst({
    where: {
      creatorId: session.user.id,
      status: { in: ["pending", "locked"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an open debate. Close it before creating a new one.", code: "OPEN_DEBATE_EXISTS" },
      { status: 409 }
    );
  }

  const now = new Date();

  // ── AI Practice Opponent ──────────────────────────────────────────────────
  if (data.type === "ai") {
    const aiUser = await getOrCreateAiUser();

    const challenge = await db.challenge.create({
      data: {
        type: "ai",
        status: "active",
        motion: data.motion.trim(),
        categoryId: data.categoryId,
        format: data.format,
        ranked: false,
        isPublic: false,
        isPractice: true,
        timerPreset: 0,
        creatorId: session.user.id,
        targetId: aiUser.id,
        creatorAccepted: true,
        targetAccepted: true,
        lockedAt: now,
        expiresAt: null,
      },
    });

    // User is always proposition (coin flip winner = user), AI is opposition
    const prepEndsAt = new Date(now.getTime() + PREP_SECONDS * 1000);
    await db.debate.create({
      data: {
        challengeId: challenge.id,
        categoryId: data.categoryId,
        motion: data.motion.trim(),
        format: data.format,
        ranked: false,
        isPublic: false,
        isPractice: true,
        isAiOpponent: true,
        timerPreset: getRoundTimer(data.format, "opening"),
        debaterAId: session.user.id,  // user = debaterA = proposition
        debaterBId: aiUser.id,        // AI = debaterB = opposition
        status: "active",
        phase: "prep",
        coinFlipWinnerId: session.user.id,
        currentUserId: session.user.id,
        currentTurnIndex: 0,
        prepEndsAt,
        startedAt: now,
      },
    });

    return NextResponse.json({ id: challenge.id, aiDebate: true }, { status: 201 });
  }

  // ── Resolve target user for direct challenges ─────────────────────────────
  let targetId: string | undefined;
  if (data.type === "direct") {
    if (!data.targetUsername) {
      return NextResponse.json({ error: "Target username required for direct challenges." }, { status: 400 });
    }
    const target = await db.user.findUnique({ where: { username: data.targetUsername } });
    if (!target) {
      return NextResponse.json({ error: `User "${data.targetUsername}" not found.` }, { status: 400 });
    }
    if (target.id === session.user.id) {
      return NextResponse.json({ error: "You cannot challenge yourself." }, { status: 400 });
    }
    targetId = target.id;
  }

  // Expiry: open = 15 min, direct = 24h
  const expiresAt =
    data.type === "open"
      ? new Date(now.getTime() + 15 * 60 * 1000)
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const challenge = await db.challenge.create({
    data: {
      type: data.type,
      status: "pending",
      motion: data.motion.trim(),
      categoryId: data.categoryId,
      format: data.format,
      ranked,
      isPublic,
      isPractice,
      timerPreset: 0,
      creatorId: session.user.id,
      targetId: targetId ?? null,
      creatorAccepted: true,
      expiresAt,
    },
  });

  // Notify target user for direct challenges
  if (data.type === "direct" && targetId) {
    const creator = await db.user.findUnique({
      where: { id: session.user.id },
      select: { username: true },
    });
    await createNotification(targetId, {
      type: "challenge_received",
      title: "You've been challenged!",
      body: `${creator?.username ?? "Someone"} has challenged you: "${data.motion.slice(0, 80)}"`,
      href: `/challenges/${challenge.id}/lobby`,
      challengeId: challenge.id,
    });
  }

  return NextResponse.json({ id: challenge.id }, { status: 201 });
}

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const challenges = await db.challenge.findMany({
    where: {
      OR: [
        { creatorId: session.user.id },
        { targetId: session.user.id },
      ],
      status: { not: "active" }, // active ones are full debates, shown elsewhere
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
    include: {
      category: { select: { id: true, label: true, emoji: true, slug: true } },
      creator: { select: { id: true, username: true, avatarUrl: true } },
      target: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(challenges);
}
