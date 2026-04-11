import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.isDeleted) return NextResponse.json({ error: "Already deleted" }, { status: 400 });

  // Soft delete — anonymize personal data, preserve debate history
  await db.user.update({
    where: { id: userId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      username: `[deleted_${userId.slice(0, 8)}]`,
      email: `deleted_${userId}@deleted.invalid`,
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

  // Revoke all sessions
  await db.session.deleteMany({ where: { userId } });
  await db.account.deleteMany({ where: { userId } });

  return NextResponse.json({ ok: true });
}
