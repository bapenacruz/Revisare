import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const username = searchParams.get("username") ?? "";
  const status = searchParams.get("status") ?? "all";
  const category = searchParams.get("category") ?? "all";
  const ranked = searchParams.get("ranked") ?? "all";
  const deleted = searchParams.get("deleted") ?? "false";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const minViewers = searchParams.get("minViewers") ?? "";
  const maxViewers = searchParams.get("maxViewers") ?? "";
  const minComments = searchParams.get("minComments") ?? "";
  const maxComments = searchParams.get("maxComments") ?? "";
  const minVotes = searchParams.get("minVotes") ?? "";
  const maxVotes = searchParams.get("maxVotes") ?? "";

  const where: Record<string, unknown> = {};
  if (q) where.motion = { contains: q, mode: "insensitive" };
  if (username) {
    where.OR = [
      { debaterA: { username: { contains: username, mode: "insensitive" } } },
      { debaterB: { username: { contains: username, mode: "insensitive" } } },
    ];
  }

  if (status === "deleted") {
    where.isDeleted = true;
  } else if (status === "hidden") {
    where.isHidden = true;
    where.isDeleted = false;
  } else if (status !== "all") {
    where.status = status;
    if (deleted !== "true") where.isDeleted = false;
  } else {
    if (deleted !== "true") where.isDeleted = false;
  }

  if (category !== "all") where.categoryId = category;
  if (ranked === "yes") where.ranked = true;
  if (ranked === "no") where.ranked = false;

  if (dateFrom || dateTo) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); dateFilter.lte = to; }
    where.createdAt = dateFilter;
  }

  const countWhere: Record<string, unknown> = {};
  if (minViewers || maxViewers) {
    const f: Record<string, number> = {};
    if (minViewers) f.gte = parseInt(minViewers, 10);
    if (maxViewers) f.lte = parseInt(maxViewers, 10);
    countWhere.spectatorMessages = f;
  }
  if (minComments || maxComments) {
    const f: Record<string, number> = {};
    if (minComments) f.gte = parseInt(minComments, 10);
    if (maxComments) f.lte = parseInt(maxComments, 10);
    countWhere.debateComments = f;
  }
  if (minVotes || maxVotes) {
    const f: Record<string, number> = {};
    if (minVotes) f.gte = parseInt(minVotes, 10);
    if (maxVotes) f.lte = parseInt(maxVotes, 10);
    countWhere.audienceVotes = f;
  }
  if (Object.keys(countWhere).length > 0) where._count = countWhere;

  const debates = await db.debate.findMany({
    where,
    select: {
      id: true,
      challengeId: true,
      motion: true,
      status: true,
      ranked: true,
      categoryId: true,
      isDeleted: true,
      isHidden: true,
      category: { select: { label: true, emoji: true } },
      debaterA: { select: { username: true, email: true } },
      debaterB: { select: { username: true, email: true } },
      winnerId: true,
      createdAt: true,
      _count: { select: { spectatorMessages: true, debateComments: true, audienceVotes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const json = JSON.stringify(debates, null, 2);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="debates-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
