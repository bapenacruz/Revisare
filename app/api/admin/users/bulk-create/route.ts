import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const UserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/, "Username must contain only letters, numbers, underscores or dots"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8).optional(),
  role: z.enum(["user", "admin"]).optional().default("user"),
  planType: z.enum(["unpaid", "paid"]).optional().default("unpaid"),
  bio: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
});

type UserInput = z.infer<typeof UserSchema>;

export interface BulkCreateResult {
  index: number;
  username: string;
  status: "created" | "skipped" | "error";
  error?: string;
  userId?: string;
  generatedPassword?: string;
}

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
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

    // Check for existing username or email
    const existing = await db.user.findFirst({
      where: { OR: [{ username: data.username }, { email: data.email }] },
      select: { id: true, username: true, email: true },
    });

    if (existing) {
      results.push({
        index: i,
        username: data.username,
        status: "skipped",
        error: existing.username === data.username ? "Username already taken" : "Email already registered",
      });
      continue;
    }

    const plainPassword = data.password ?? generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    try {
      const user = await db.user.create({
        data: {
          username: data.username,
          email: data.email,
          hashedPassword,
          role: data.role ?? "user",
          planType: data.planType ?? "unpaid",
          bio: data.bio ?? null,
          country: data.country ?? null,
          onboardingComplete: true,
        },
        select: { id: true },
      });

      results.push({
        index: i,
        username: data.username,
        status: "created",
        userId: user.id,
        // Only expose generated password (not user-supplied ones)
        ...(!data.password ? { generatedPassword: plainPassword } : {}),
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
