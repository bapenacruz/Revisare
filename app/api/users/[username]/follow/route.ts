import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

interface Ctx {
  params: Promise<{ username: string }>;
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await params;
  const target = await db.user.findUnique({
    where: { username },
    select: { id: true, followApproval: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === session.user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  // If the target requires follow approval, create a request instead
  if (target.followApproval) {
    const existing = await db.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId: session.user.id, targetId: target.id } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ following: false, pending: true });

    const request = await db.followRequest.create({
      data: { requesterId: session.user.id, targetId: target.id },
    });
    const requester = await db.user.findUnique({
      where: { id: session.user.id },
      select: { username: true },
    });
    await createNotification(target.id, {
      type: "follow_request",
      title: "New follow request",
      body: `${requester?.username ?? "Someone"} wants to follow you.`,
      href: `/users/${requester?.username}`,
      requestId: request.id,
    });
    return NextResponse.json({ following: false, pending: true });
  }

  await db.follow.upsert({
    where: { followerId_followingId: { followerId: session.user.id, followingId: target.id } },
    create: { followerId: session.user.id, followingId: target.id },
    update: {},
  });

  const follower = await db.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });

  await createNotification(target.id, {
    type: "new_follower",
    title: "New follower",
    body: `${follower?.username ?? "Someone"} started following you.`,
    href: `/users/${follower?.username}`,
  });

  return NextResponse.json({ following: true, pending: false });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await params;
  const target = await db.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await Promise.all([
    db.follow.deleteMany({
      where: { followerId: session.user.id, followingId: target.id },
    }),
    db.followRequest.deleteMany({
      where: { requesterId: session.user.id, targetId: target.id },
    }),
  ]);

  return NextResponse.json({ following: false, pending: false });
}
