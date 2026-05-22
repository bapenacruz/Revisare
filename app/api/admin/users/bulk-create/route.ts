import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const UserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/, "Username must contain only letters, numbers, underscores or dots"),
  country: z.string().max(100).optional(),
  aiAssessment: z.string().max(5000).optional(),
});

type UserInput = z.infer<typeof UserSchema>;

export interface BulkCreateResult {
  index: number;
  username: string;
  status: "created" | "skipped" | "error";
  error?: string;
  userId?: string;
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
    return NextResponse.json({ error: "Expected a JSON array of users" }, { status: 400 });
  }

  if (body.length === 0) {
    return NextResponse.json({ error: "Array is empty" }, { status: 400 });
  }

  if (body.length > 500) {
    return NextResponse.json({ error: "Maximum 500 users per upload" }, { status: 400 });
  }

  const results: BulkCreateResult[] = [];

  for (let i = 0; i < body.length; i++) {
    const raw = body[i];
    const parsed = UserSchema.safeParse(raw);

    if (!parsed.success) {
      results.push({
        index: i,
        username: (raw as Record<string, unknown>)?.username as string ?? `User #${i + 1}`,
        status: "error",
        error: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      });
      continue;
    }

    const data: UserInput = parsed.data;

    // Check for existing username
    const existing = await db.user.findFirst({
      where: { username: data.username },
      select: { id: true },
    });

    if (existing) {
      results.push({
        index: i,
        username: data.username,
        status: "skipped",
        error: "Username already taken",
      });
      continue;
    }

    // Synthetic users get a placeholder email (marks them as non-real)
    const placeholderEmail = `${data.username}@placeholder.com`;
    const now = new Date();

    try {
      const user = await db.user.create({
        data: {
          username: data.username,
          email: placeholderEmail,
          hashedPassword: null,
          role: "user",
          planType: "paid",
          elo: 1000,
          wins: 0,
          losses: 0,
          bio: null,
          websiteUrl: null,
          country: data.country ?? null,
          onboardingComplete: true,
          isExhibition: false,
          hideFromLeaderboard: false,
          emailVerified: now,
          ...(data.aiAssessment ? {
            aiAssessment: data.aiAssessment,
            aiAssessmentUpdatedAt: now,
          } : {}),
        },
        select: { id: true },
      });

      results.push({
        index: i,
        username: data.username,
        status: "created",
        userId: user.id,
      });
    } catch (err) {
      results.push({
        index: i,
        username: data.username,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ results, created, skipped, errors });
}
