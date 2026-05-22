import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

const MAX_BYTES = 2 * 1024 * 1024;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { imageDataUrl, linkUrl, altText, targetRegions, targetCompassQuadrants, isActive } = body;

  const data: Record<string, unknown> = {};

  if (imageDataUrl !== undefined) {
    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }
    if (Buffer.byteLength(imageDataUrl, "utf8") > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 2 MB)" }, { status: 413 });
    }
    data.imageDataUrl = imageDataUrl;
  }

  if (linkUrl !== undefined) data.linkUrl = linkUrl?.trim() || null;
  if (altText !== undefined) data.altText = altText?.trim() || null;
  if (Array.isArray(targetRegions)) data.targetRegions = targetRegions;
  if (Array.isArray(targetCompassQuadrants)) data.targetCompassQuadrants = targetCompassQuadrants;
  if (isActive !== undefined) data.isActive = isActive;

  const banner = await db.adBanner.update({ where: { id }, data });
  return NextResponse.json(banner);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.adBanner.update({ where: { id }, data: { isDeleted: true } });
  return NextResponse.json({ ok: true });
}
