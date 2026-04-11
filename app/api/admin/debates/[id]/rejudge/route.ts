import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { judgeDebate } from "@/lib/judging/run";

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

  // Delete existing judge results so judgeDebate can store fresh ones
  await db.judgeResult.deleteMany({ where: { debateId: id } });

  try {
    await judgeDebate(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Judging failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
