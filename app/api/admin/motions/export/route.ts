import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

// GET /api/admin/motions/export — download all motions as plain text (one per line)
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const motions = await db.motionLibrary.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: { select: { label: true, slug: true } } },
  });

  const lines = motions.map((m) => m.text).join("\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="motions-${new Date().toISOString().slice(0, 10)}.txt"`,
    },
  });
}
