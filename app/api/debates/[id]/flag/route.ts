import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;

  const debate = await db.debate.findUnique({
    where: { challengeId },
    select: { id: true, debaterAId: true, debaterBId: true },
  });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    type?: string;
    description?: string;
    flaggedUserId?: string;
  };

  const type = typeof body.type === "string" ? body.type : "user_report";
  const description = typeof body.description === "string" ? body.description.slice(0, 500) : null;
  const flaggedUserId =
    typeof body.flaggedUserId === "string" ? body.flaggedUserId : null;

  // Prevent duplicate pending reports from same user on same debate
  const existing = await db.integrityFlag.findFirst({
    where: {
      debateId: debate.id,
      reporterId: session.user.id,
      status: "pending",
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You have already reported this debate." },
      { status: 409 },
    );
  }

  await db.integrityFlag.create({
    data: {
      debateId: debate.id,
      userId: flaggedUserId,
      reporterId: session.user.id,
      type,
      description,
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
