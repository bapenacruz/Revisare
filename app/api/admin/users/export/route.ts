import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "../../../../../generated/prisma/client/client";

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const status = searchParams.get("status") ?? "";
  const role = searchParams.get("role") ?? "";
  const joinedFrom = searchParams.get("joinedFrom") ?? "";
  const joinedTo = searchParams.get("joinedTo") ?? "";
  const minElo = searchParams.get("minElo") ?? "";
  const maxElo = searchParams.get("maxElo") ?? "";
  const minWins = searchParams.get("minWins") ?? "";
  const maxWins = searchParams.get("maxWins") ?? "";
  const minLosses = searchParams.get("minLosses") ?? "";
  const maxLosses = searchParams.get("maxLosses") ?? "";

  const conditions: Prisma.UserWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (type === "real") conditions.push({ isExhibition: false });
  if (type === "synthetic") conditions.push({ isExhibition: true });
  if (role) conditions.push({ role });
  if (status === "active") conditions.push({ isDeleted: false, suspendedUntil: null });
  if (status === "suspended") conditions.push({ suspendedUntil: { not: null, gt: new Date() } });
  if (status === "banned") conditions.push({ suspendedUntil: { equals: new Date("9999-01-01") } });
  if (status === "deleted") conditions.push({ isDeleted: true });
  if (!status) conditions.push({ isDeleted: false });

  if (joinedFrom || joinedTo) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (joinedFrom) dateFilter.gte = new Date(joinedFrom);
    if (joinedTo) { const to = new Date(joinedTo); to.setHours(23, 59, 59, 999); dateFilter.lte = to; }
    conditions.push({ createdAt: dateFilter });
  }
  if (minElo || maxElo) {
    const f: { gte?: number; lte?: number } = {};
    if (minElo) f.gte = parseInt(minElo, 10);
    if (maxElo) f.lte = parseInt(maxElo, 10);
    conditions.push({ elo: f });
  }
  if (minWins || maxWins) {
    const f: { gte?: number; lte?: number } = {};
    if (minWins) f.gte = parseInt(minWins, 10);
    if (maxWins) f.lte = parseInt(maxWins, 10);
    conditions.push({ wins: f });
  }
  if (minLosses || maxLosses) {
    const f: { gte?: number; lte?: number } = {};
    if (minLosses) f.gte = parseInt(minLosses, 10);
    if (maxLosses) f.lte = parseInt(maxLosses, 10);
    conditions.push({ losses: f });
  }

  const where: Prisma.UserWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const users = await db.user.findMany({
    where,
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
