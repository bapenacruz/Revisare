import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const banners = await db.adBanner.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(banners);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { imageDataUrl, linkUrl, altText, targetRegions, targetCompassQuadrants, targetUsernames, businessName } = body;

  if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid or missing image data URL" }, { status: 400 });
  }

  if (Buffer.byteLength(imageDataUrl, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 2 MB)" }, { status: 413 });
  }

  const banner = await db.adBanner.create({
    data: {
      imageDataUrl,
      linkUrl: linkUrl?.trim() || null,
      altText: altText?.trim() || null,
      businessName: businessName?.trim() || null,
      targetRegions: Array.isArray(targetRegions) ? targetRegions : [],
      targetCompassQuadrants: Array.isArray(targetCompassQuadrants) ? targetCompassQuadrants : [],
      targetUsernames: Array.isArray(targetUsernames) ? targetUsernames : [],
    },
  });

  return NextResponse.json(banner, { status: 201 });
}
