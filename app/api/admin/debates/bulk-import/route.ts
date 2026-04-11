import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { judgeDebate } from "@/lib/judging";

const TurnSchema = z.object({
  username: z.string().min(1),
  roundName: z.enum(["opening", "rebuttal", "closing"]),
  content: z.string().min(1),
});

const DebateSchema = z.object({
  motion: z.string().min(10).max(500),
  category_slug: z.string().min(1),
  format: z.enum(["quick", "standard"]),
  ranked: z.boolean().optional().default(false),
  debaterA: z.object({ username: z.string().min(1), side: z.enum(["proposition", "opposition"]) }),
  debaterB: z.object({ username: z.string().min(1), side: z.enum(["proposition", "opposition"]) }),
  turns: z.array(TurnSchema).min(1),
  winner_username: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
});

type DebateInput = z.infer<typeof DebateSchema>;

export interface ImportResult {
  index: number;
  motion: string;
  status: "created" | "error";
  error?: string;
  debateId?: string;
  createdUsers?: string[];
  skipped?: boolean;
}

async function findOrCreateUser(username: string): Promise<{ id: string; created: boolean }> {
  const existing = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };

  // Create placeholder user
  const placeholderEmail = `${username}@placeholder.com`;
  const emailTaken = await db.user.findUnique({ where: { email: placeholderEmail }, select: { id: true } });
  if (emailTaken) return { id: emailTaken.id, created: false };

  const hashed = await bcrypt.hash(Math.random().toString(36) + Math.random().toString(36), 10);
  const user = await db.user.create({
    data: {
      username,
      email: placeholderEmail,
      hashedPassword: hashed,
      onboardingComplete: true,
      isExhibition: true,
    },
    select: { id: true },
  });
  return { id: user.id, created: true };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected a JSON array of debates" }, { status: 400 });
  }

  if (body.length === 0) {
    return NextResponse.json({ error: "Array is empty" }, { status: 400 });
  }

  const results: ImportResult[] = [];

  for (let i = 0; i < body.length; i++) {
    const raw = body[i];
    const parsed = DebateSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        index: i,
        motion: (raw as Record<string, unknown>)?.motion as string ?? `Debate #${i + 1}`,
        status: "error",
        error: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      });
      continue;
    }

    const data: DebateInput = parsed.data;

    // Validate that debaterA and debaterB have different sides
    if (data.debaterA.side === data.debaterB.side) {
      results.push({
        index: i,
        motion: data.motion,
        status: "error",
        error: "debaterA and debaterB must have different sides (proposition/opposition)",
      });
      continue;
    }

    // Validate that turn usernames belong to one of the two debaters
    const validUsernames = new Set([data.debaterA.username, data.debaterB.username]);
    const invalidTurn = data.turns.find((t) => !validUsernames.has(t.username));
    if (invalidTurn) {
      results.push({
        index: i,
        motion: data.motion,
        status: "error",
        error: `Turn username "${invalidTurn.username}" is not one of the two debaters`,
      });
      continue;
    }

    // Validate winner_username
    if (data.winner_username && !validUsernames.has(data.winner_username)) {
      results.push({
        index: i,
        motion: data.motion,
        status: "error",
        error: `winner_username "${data.winner_username}" is not one of the two debaters`,
      });
      continue;
    }

    try {
      // Resolve category
      const category = await db.category.findUnique({
        where: { slug: data.category_slug },
        select: { id: true },
      });
      if (!category) {
        results.push({
          index: i,
          motion: data.motion,
          status: "error",
          error: `Category slug "${data.category_slug}" not found`,
        });
        continue;
      }

      // Find or create users
      const createdUsers: string[] = [];
      const [userA, userB] = await Promise.all([
        findOrCreateUser(data.debaterA.username),
        findOrCreateUser(data.debaterB.username),
      ]);
      if (userA.created) createdUsers.push(data.debaterA.username);
      if (userB.created) createdUsers.push(data.debaterB.username);

      // Proposition is debaterA in our schema (challenge creator)
      const propositionUsername = data.debaterA.side === "proposition"
        ? data.debaterA.username
        : data.debaterB.username;
      const debaterAId = data.debaterA.side === "proposition" ? userA.id : userB.id;
      const debaterBId = data.debaterA.side === "proposition" ? userB.id : userA.id;

      // Resolve winner
      let winnerId: string | null = null;
      if (data.winner_username) {
        winnerId =
          data.winner_username === data.debaterA.username ? debaterAId : debaterBId;
      }

      const completedAt = data.completed_at ? new Date(data.completed_at) : new Date();

      // Create challenge + debate in a transaction
      const { debate } = await db.$transaction(async (tx) => {
        const challenge = await tx.challenge.create({
          data: {
            type: "open",
            status: "completed",
            motion: data.motion,
            categoryId: category.id,
            format: data.format,
            ranked: data.ranked,
            isPublic: true,
            timerPreset: data.format === "quick" ? 180 : 300,
            creatorId: debaterAId,
            creatorAccepted: true,
            targetAccepted: true,
          },
          select: { id: true },
        });

        const debate = await tx.debate.create({
          data: {
            challengeId: challenge.id,
            categoryId: category.id,
            motion: data.motion,
            format: data.format,
            ranked: data.ranked,
            isPublic: true,
            timerPreset: data.format === "quick" ? 180 : 300,
            status: "completed",
            phase: "completed",
            debaterAId,
            debaterBId,
            winnerId,
            coinFlipWinnerId: debaterAId, // proposition is coin flip winner by convention
            startedAt: completedAt,
            completedAt,
          },
          select: { id: true },
        });

        // Create turns
        await tx.debateTurn.createMany({
          data: data.turns.map((t, idx) => {
            const userIdForTurn =
              t.username === data.debaterA.username ? userA.id : userB.id;
            return {
              debateId: debate.id,
              userId: userIdForTurn,
              roundName: t.roundName,
              content: t.content,
              isAutoSubmit: false,
              submittedAt: new Date(completedAt.getTime() + idx * 60000),
            };
          }),
        });

        return { debate };
      });

      // Update win/loss on users if there's a winner
      if (winnerId) {
        const loserId = winnerId === debaterAId ? debaterBId : debaterAId;
        await Promise.all([
          db.user.update({ where: { id: winnerId }, data: { wins: { increment: 1 } } }),
          db.user.update({ where: { id: loserId }, data: { losses: { increment: 1 } } }),
        ]);
      }

      // Trigger AI assessment for this debate (async, don't wait)
      // This ensures all imported debates get proper AI judge results
      judgeDebate(debate.id).catch((err) => {
        console.error(`[Bulk Import] Failed to trigger AI assessment for debate ${debate.id}:`, err);
        // Don't fail the import if AI assessment fails - it can be triggered later via admin tools
      });

      results.push({
        index: i,
        motion: data.motion,
        status: "created",
        debateId: debate.id,
        createdUsers,
      });
    } catch (err) {
      results.push({
        index: i,
        motion: data.motion,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ created, errors, results });
}
