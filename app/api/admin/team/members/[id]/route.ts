import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_BYTES = 1.5 * 1024 * 1024;

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

// PATCH /api/admin/team/members/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.imageDataUrl && Buffer.byteLength(body.imageDataUrl, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 1.5 MB)" }, { status: 413 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.role === "string") data.role = body.role.trim();
  if ("description" in body) data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if ("imageDataUrl" in body) data.imageDataUrl = body.imageDataUrl ?? null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.order === "number") data.order = body.order;

  const member = await db.teamMember.update({ where: { id }, data });
  return NextResponse.json({ member });
}

// DELETE /api/admin/team/members/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.teamMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
