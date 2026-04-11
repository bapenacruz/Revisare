import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const follows = await db.follow.findMany({
    where: { followerId: session.user.id },
    include: {
      following: {
        select: { id: true, username: true, avatarUrl: true },
      },
    },
    orderBy: { following: { username: "asc" } },
  });

  return NextResponse.json(follows.map((f) => f.following));
}
