import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { VISIBLE_NOTIFICATION_TYPES } from "@/lib/notifications";

const PAGE_SIZE = 15;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const typeFilter = searchParams.get("type");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const typeWhere = typeFilter && typeFilter !== "all"
    ? [typeFilter as (typeof VISIBLE_NOTIFICATION_TYPES)[number]]
    : VISIBLE_NOTIFICATION_TYPES;

  const where = {
    userId: session.user.id,
    type: { in: typeWhere },
    ...(unreadOnly ? { read: false } : {}),
  };

  const [allNotifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    db.notification.count({
      where: {
        userId: session.user.id,
        read: false,
        type: { in: VISIBLE_NOTIFICATION_TYPES },
      },
    }),
  ]);

  // Deduplicate: keep only the latest notification per (type + payload string)
  const seen = new Set<string>();
  const deduped = allNotifications.filter((n) => {
    const key = `${n.type}:${n.payload}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const total = deduped.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = deduped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return NextResponse.json({
    notifications: paginated.map((n) => ({
      id: n.id,
      type: n.type,
      payload: JSON.parse(n.payload) as Record<string, unknown>,
      read: n.read,
      createdAt: n.createdAt,
    })),
    unreadCount,
    total,
    totalPages,
    page,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { ids?: string[] };

  if (body.ids && body.ids.length > 0) {
    await db.notification.updateMany({
      where: { id: { in: body.ids }, userId: session.user.id },
      data: { read: true },
    });
  } else {
    await db.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });
  }

  return NextResponse.json({ success: true });
}
