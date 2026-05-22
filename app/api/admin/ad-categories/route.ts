import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const cats = await db.adCategory.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(cats);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug, label, emoji, order } = await req.json();
  if (!slug?.trim() || !label?.trim()) {
    return NextResponse.json({ error: "slug and label are required" }, { status: 400 });
  }

  const cat = await db.adCategory.create({
    data: {
      slug: slug.trim().toLowerCase(),
      label: label.trim(),
      emoji: emoji?.trim() || "📢",
      order: order ?? 0,
    },
  });
  return NextResponse.json(cat, { status: 201 });
}
