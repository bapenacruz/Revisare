import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { motion?: string; categoryId?: string; isHidden?: boolean };

  const data: { motion?: string; categoryId?: string; isHidden?: boolean } = {};
  if (typeof body.motion === "string" && body.motion.trim()) {
    data.motion = body.motion.trim();
  }
  if (typeof body.categoryId === "string" && body.categoryId.trim()) {
    data.categoryId = body.categoryId.trim();
  }
  if (typeof body.isHidden === "boolean") {
    data.isHidden = body.isHidden;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await db.debate.update({ where: { id }, data });
  return NextResponse.json({ ok: true, debate: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const debate = await db.debate.findUnique({ where: { id } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft delete
  const updated = await db.debate.update({ 
    where: { id }, 
    data: { isDeleted: true } 
  });

  // Remove all notifications referencing this debate
  await db.notification.deleteMany({
    where: { payload: { contains: debate.challengeId } },
  });

  // Reverse wins/losses/ELO if it was a ranked completed debate with a winner
  if (debate.ranked && debate.winnerId && debate.status === "completed" && !debate.isDeleted) {
    const loserId = debate.winnerId === debate.debaterAId ? debate.debaterBId : debate.debaterAId;
    await db.user.update({
      where: { id: debate.winnerId },
      data: { wins: { decrement: 1 }, elo: { decrement: 25 } },
    });
    await db.user.update({
      where: { id: loserId },
      data: { losses: { decrement: 1 }, elo: { increment: 25 } },
    });
  }
  
  return NextResponse.json({ ok: true, debate: updated });
}
