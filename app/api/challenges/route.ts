import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateMotion } from "@/lib/topic-validator";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["open", "direct"]),
  motion: z.string().min(10).max(280),
  categoryId: z.string().min(1),
  format: z.enum(["quick", "standard"]),
  ranked: z.boolean(),
  isPublic: z.boolean(),
  targetUsername: z.string().optional(), // for direct challenges
});

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

  // Enforce: ranked => must be public
  if (data.ranked && !data.isPublic) {
    return NextResponse.json(
      { error: "Ranked challenges must be public." },
      { status: 400 }
    );
  }

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
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an open debate. Close it before creating a new one.", code: "OPEN_DEBATE_EXISTS" },
      { status: 409 }
    );
  }

  // Resolve target user for direct challenges
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

  // Expiry: open = 15 min inactivity (stored as absolute from now), direct = 24h
  const now = new Date();
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
      ranked: data.ranked,
      isPublic: data.isPublic,
      timerPreset: 0,
      creatorId: session.user.id,
      targetId: targetId ?? null,
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
