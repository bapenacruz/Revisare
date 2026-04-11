import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: targetId } = await params;
  const body = await req.json() as { hideFromLeaderboard?: boolean; username?: string };

  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (typeof body.hideFromLeaderboard === "boolean") {
    data.hideFromLeaderboard = body.hideFromLeaderboard;
  }

  if (typeof body.username === "string") {
    const newUsername = body.username.trim();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(newUsername)) {
      return NextResponse.json({ error: "Invalid username format" }, { status: 400 });
    }
    // Only allow rename for placeholder users
    if (!target.email.endsWith("@placeholder.com")) {
      return NextResponse.json({ error: "Username can only be changed for placeholder users" }, { status: 403 });
    }
    const clash = await db.user.findUnique({ where: { username: newUsername }, select: { id: true } });
    if (clash && clash.id !== targetId) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    data.username = newUsername;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.user.update({ where: { id: targetId }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: targetId } = await params;

  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.isDeleted) return NextResponse.json({ error: "Already deleted" }, { status: 400 });

  // Soft delete — preserve the record so debate history stays intact.
  // Anonymize all personal data but keep the user row for FK references.
  await db.user.update({
    where: { id: targetId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      username: `[deleted_${targetId.slice(0, 8)}]`,
      email: `deleted_${targetId}@deleted.invalid`,
      hashedPassword: null,
      bio: null,
      avatarUrl: null,
      country: null,
      twitterHandle: null,
      threadsHandle: null,
      truthSocialHandle: null,
      blueskyHandle: null,
      mastodonHandle: null,
      websiteUrl: null,
      aiAssessment: null,
    },
  });

  // Revoke all sessions so they're immediately signed out
  await db.session.deleteMany({ where: { userId: targetId } });
  await db.account.deleteMany({ where: { userId: targetId } });

  return NextResponse.json({ ok: true });
}
