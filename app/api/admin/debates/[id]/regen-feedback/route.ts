import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { regeneratePrivateFeedback } from "@/lib/judging/run";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const debate = await db.debate.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (debate.status !== "completed") {
    return NextResponse.json({ error: "Debate is not completed" }, { status: 400 });
  }

  // Fire off feedback regeneration in background
  void regeneratePrivateFeedback(id).catch((err) => {
    console.error(`[regen-feedback] Failed for debate ${id}:`, err);
  });

  return NextResponse.json({
    ok: true,
    message: "Feedback regeneration started. Results will appear in ~30s.",
  });
}
