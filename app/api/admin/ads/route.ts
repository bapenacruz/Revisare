import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category") ?? "all";
  const active = searchParams.get("active") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 30;

  const where: Record<string, unknown> = { isDeleted: false };
  if (q) where.motion = { contains: q, mode: "insensitive" };
  if (category !== "all") where.categoryId = category;
  if (active === "yes") where.isActive = true;
  if (active === "no") where.isActive = false;

  const [ads, total] = await Promise.all([
    db.ad.findMany({
      where,
      include: { category: { select: { label: true, emoji: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.ad.count({ where }),
  ]);

  return NextResponse.json({ ads, total });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { motion, proponentName, opponentName, categoryId, linkUrl } = body;

  if (!motion?.trim() || !proponentName?.trim() || !opponentName?.trim()) {
    return NextResponse.json({ error: "motion, proponentName, opponentName are required" }, { status: 400 });
  }

  const ad = await db.ad.create({
    data: {
      motion: motion.trim(),
      proponentName: proponentName.trim(),
      opponentName: opponentName.trim(),
      categoryId: categoryId || null,
      linkUrl: linkUrl?.trim() || null,
    },
    include: { category: { select: { label: true, emoji: true } } },
  });

  return NextResponse.json(ad, { status: 201 });
}
