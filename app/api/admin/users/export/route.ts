import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      planType: true,
      elo: true,
      wins: true,
      losses: true,
      bio: true,
      country: true,
      websiteUrl: true,
      onboardingComplete: true,
      isExhibition: true,
      hideFromLeaderboard: true,
      aiAssessment: true,
      aiAssessmentUpdatedAt: true,
      createdAt: true,
      _count: { select: { debaterA: true, debaterB: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const json = JSON.stringify(users, null, 2);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="users-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
