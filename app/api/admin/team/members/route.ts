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

// GET /api/admin/team/members
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await db.teamMember.findMany({
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ members });
}

// POST /api/admin/team/members
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body.role !== "string" || !body.role.trim()) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }
  if (body.imageDataUrl && Buffer.byteLength(body.imageDataUrl, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 1.5 MB)" }, { status: 413 });
  }

  // Determine next order value
  const last = await db.teamMember.findFirst({ orderBy: { order: "desc" }, select: { order: true } });

  const member = await db.teamMember.create({
    data: {
      name: body.name.trim(),
      role: body.role.trim(),
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      imageDataUrl: body.imageDataUrl ?? null,
      order: (last?.order ?? -1) + 1,
      isActive: body.isActive !== false,
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}
