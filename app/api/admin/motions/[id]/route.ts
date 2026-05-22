import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

// DELETE /api/admin/motions/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.motionLibrary.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/motions/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { text?: string; categoryId?: string | null; notes?: string };

  const data: { text?: string; categoryId?: string | null; notes?: string | null } = {};
  if (typeof body.text === "string" && body.text.trim()) data.text = body.text.trim();
  if ("categoryId" in body) data.categoryId = body.categoryId ?? null;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;

  const motion = await db.motionLibrary.update({
    where: { id },
    data,
    include: { category: { select: { id: true, label: true, emoji: true, slug: true } } },
  });
  return NextResponse.json({ motion });
}
