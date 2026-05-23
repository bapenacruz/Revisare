import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { ids?: unknown };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  const ids: string[] = body.ids.filter((id): id is string => typeof id === "string");
  if (ids.length === 0) {
    return NextResponse.json({ error: "No valid ids provided" }, { status: 400 });
  }

  // Fetch challenge IDs needed for notification cleanup
  const debates = await db.debate.findMany({
    where: { id: { in: ids } },
    select: { challengeId: true },
  });
  const challengeIds = debates.map((d) => d.challengeId);

  // Soft-delete all selected debates
  await db.debate.updateMany({
    where: { id: { in: ids } },
    data: { isDeleted: true },
  });

  // Hard-delete comments and subscriptions for those debates
  await db.debateCommentSubscription.deleteMany({ where: { debateId: { in: ids } } });
  await db.debateComment.deleteMany({ where: { debateId: { in: ids } } });

  // Remove notifications referencing any of these debates
  if (challengeIds.length > 0) {
    for (const cid of challengeIds) {
      await db.notification.deleteMany({ where: { payload: { contains: cid } } });
    }
  }

  return NextResponse.json({ ok: true, deleted: ids.length });
}
