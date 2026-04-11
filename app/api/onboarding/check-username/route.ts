import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = req.nextUrl.searchParams.get("username") ?? "";

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ available: false, error: "3–20 chars, lowercase letters, numbers, underscores only." });
  }

  // Exclude current user's own username from the conflict check
  const existing = await db.user.findFirst({
    where: { username, NOT: { id: session.user.id } },
    select: { id: true },
  });

  return NextResponse.json({ available: !existing });
}
