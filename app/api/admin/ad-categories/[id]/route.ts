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
  const { slug, label, emoji, order, isActive } = await req.json();

  const data: Record<string, unknown> = {};
  if (slug !== undefined) data.slug = slug.trim().toLowerCase();
  if (label !== undefined) data.label = label.trim();
  if (emoji !== undefined) data.emoji = emoji.trim();
  if (order !== undefined) data.order = order;
  if (isActive !== undefined) data.isActive = isActive;

  const cat = await db.adCategory.update({ where: { id }, data });
  return NextResponse.json(cat);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  // Remove category from ads first, then delete
  await db.ad.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await db.adCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
