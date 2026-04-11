import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
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
