import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

// GET /api/admin/motions/export — download all motions as CSV
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const motions = await db.motionLibrary.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: { select: { label: true, slug: true } } },
  });

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const header = ["text", "category", "notes", "created_at"].join(",");
  const rows = motions.map((m) =>
    [
      escape(m.text),
      escape(m.category?.label ?? ""),
      escape(m.notes ?? ""),
      escape(new Date(m.createdAt).toISOString()),
    ].join(","),
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="motions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
