import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

// GET /api/admin/motions
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const motions = await db.motionLibrary.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { select: { id: true, label: true, emoji: true, slug: true } } },
  });
  return NextResponse.json({ motions });
}

// POST /api/admin/motions — single create
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const motion = await db.motionLibrary.create({
    data: {
      text: body.text.trim(),
      categoryId: body.categoryId ?? null,
      notes: body.notes?.trim() || null,
    },
    include: { category: { select: { id: true, label: true, emoji: true, slug: true } } },
  });
  return NextResponse.json({ motion });
}

// DELETE /api/admin/motions — bulk delete by ids[] or delete all
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { ids?: string[] };
  if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
    await db.motionLibrary.deleteMany({ where: { id: { in: body.ids } } });
  }
  return NextResponse.json({ ok: true });
}
