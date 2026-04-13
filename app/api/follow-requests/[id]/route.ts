import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

interface Ctx {
  params: Promise<{ id: string }>;
}

// POST body: { action: "accept" | "reject" }
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { action } = await req.json() as { action: "accept" | "reject" };

  const request = await db.followRequest.findUnique({
    where: { id },
    select: { id: true, requesterId: true, targetId: true },
  });

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.targetId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "accept") {
    await db.$transaction([
      db.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: request.requesterId,
            followingId: request.targetId,
          },
        },
        create: { followerId: request.requesterId, followingId: request.targetId },
        update: {},
      }),
      db.followRequest.delete({ where: { id } }),
    ]);

    // Notify the requester their request was accepted
    const accepter = await db.user.findUnique({
      where: { id: session.user.id },
      select: { username: true },
    });
    await createNotification(request.requesterId, {
      type: "new_follower",
      title: "Follow request accepted",
      body: `${accepter?.username ?? "Someone"} accepted your follow request.`,
      href: `/users/${accepter?.username}`,
    });

    return NextResponse.json({ accepted: true });
  }

  // reject
  await db.followRequest.delete({ where: { id } });
  return NextResponse.json({ rejected: true });
}
