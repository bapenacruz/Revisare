import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: debateId } = await params;
  const body = await req.json() as { reason?: string };

  const debate = await db.debate.findUnique({ where: { id: debateId } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Clear winner and mark as voided
  await db.debate.update({
    where: { id: debateId },
    data: { winnerId: null, status: "voided" },
  });

  // Revert ELO if the debate was ranked and had a winner
  if (debate.ranked && debate.winnerId) {
    const loserId =
      debate.winnerId === debate.debaterAId ? debate.debaterBId : debate.debaterAId;
    await db.user.update({
      where: { id: debate.winnerId },
      data: { wins: { decrement: 1 }, elo: { decrement: 25 } },
    });
    await db.user.update({
      where: { id: loserId },
      data: { losses: { decrement: 1 }, elo: { increment: 25 } },
    });
  }

  await db.adminAction.create({
    data: {
      adminId: session!.user!.id,
      debateId: debate.id,
      action: "void_result",
      reason: body.reason ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
