import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const ALLOWED_TYPES = [
  "Abusive Language",
  "Cheating / Collusion",
  "Harassment",
  "Inappropriate Content",
  "Misinformation",
  "Spam",
  "Other",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to report a debate." }, { status: 401 });
  }

  const { id: challengeId } = await params;
  const body = await req.json() as { type?: string; description?: string };
  const type = (body.type ?? "").trim();
  const description = (body.description ?? "").trim();

  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid report type." }, { status: 400 });
  }
  if (description.length < 10) {
    return NextResponse.json({ error: "Please provide more detail (at least 10 characters)." }, { status: 400 });
  }

  const debate = await db.debate.findUnique({
    where: { challengeId },
    select: { id: true },
  });
  if (!debate) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }

  // Prevent duplicate reports from the same user for the same debate
  const existing = await db.integrityFlag.findFirst({
    where: {
      debateId: debate.id,
      reporterId: session.user.id,
      status: "pending",
    },
  });
  if (existing) {
    return NextResponse.json({ error: "You have already reported this debate." }, { status: 409 });
  }

  await db.integrityFlag.create({
    data: {
      debateId: debate.id,
      reporterId: session.user.id,
      type,
      description,
      status: "pending",
    },
  });

  return NextResponse.json({ success: true });
}
