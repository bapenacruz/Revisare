import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const signupSchema = z.object({
  email: z.string().email().max(255),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_.]+$/, "Username can only contain letters, numbers, underscores, and periods"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, username, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing email or username
    const existing = await db.user.findFirst({
      where: { OR: [{ email: { equals: normalizedEmail, mode: "insensitive" } }, { username }] },
      select: { email: true, username: true },
    });

    if (existing?.email?.toLowerCase() === normalizedEmail) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    if (existing?.username === username) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        username,
        hashedPassword,
      },
      select: { id: true, email: true, username: true },
    });

    // Append this real user to personas.json so their profile can be inferred over time
    try {
      const personasPath = join(process.cwd(), "lib", "data", "personas.json");
      const personas: unknown[] = JSON.parse(readFileSync(personasPath, "utf-8"));
      const alreadyTracked = (personas as Array<{ username?: string }>).some(
        (p) => p.username === username
      );
      if (!alreadyTracked) {
        personas.push({
          username,
          name: null,
          email: normalizedEmail,
          password: "",
          synthetic: false,
          culture: null,
          age: null,
          gender: null,
          bio: null,
          politicalLeaning: null,
          education_level: null,
          writing_style_details: null,
          prompt: null,
          debateStyle: null,
          strongTopics: [],
          weakTopics: [],
        });
        writeFileSync(personasPath, JSON.stringify(personas, null, 2));
      }
    } catch {
      // Non-fatal — don't fail the signup if the file write fails
    }

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
