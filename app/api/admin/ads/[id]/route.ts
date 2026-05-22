import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { motion, proponentName, opponentName, categoryId, linkUrl, isActive, targetRegions, targetCompassQuadrants, businessName, officialResult, targetUsernames } = body;

  const data: Record<string, unknown> = {};
  if (motion !== undefined) data.motion = motion.trim();
  if (proponentName !== undefined) data.proponentName = proponentName.trim();
  if (opponentName !== undefined) data.opponentName = opponentName.trim();
  if (categoryId !== undefined) data.categoryId = categoryId || null;
  if (linkUrl !== undefined) data.linkUrl = linkUrl.trim() || null;
  if (isActive !== undefined) data.isActive = isActive;
  if (Array.isArray(targetRegions)) data.targetRegions = targetRegions;
  if (Array.isArray(targetCompassQuadrants)) data.targetCompassQuadrants = targetCompassQuadrants;
  if (Array.isArray(targetUsernames)) data.targetUsernames = targetUsernames;
  if (businessName !== undefined) data.businessName = businessName?.trim() || null;
  if (officialResult !== undefined) data.officialResult = officialResult?.trim() || null;

  const ad = await db.ad.update({ where: { id }, data });
  return NextResponse.json(ad);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.ad.update({ where: { id }, data: { isDeleted: true } });
  return NextResponse.json({ ok: true });
}
