import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

// POST /api/admin/motions/import
// Body: { rows: Array<{ text: string; category?: string; notes?: string }> }
// "category" is matched by slug or label (case-insensitive)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows array is required" }, { status: 400 });
  }

  // Pre-fetch all categories for matching
  const categories = await db.category.findMany({ select: { id: true, slug: true, label: true } });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const row of body.rows) {
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) { skipped.push(text || "(empty)"); continue; }
    if (text.length > 1000) { skipped.push(text.slice(0, 30) + "…"); continue; }

    let categoryId: string | null = null;
    if (row.category) {
      const needle = String(row.category).toLowerCase().trim();
      const match = categories.find(
        (c) => c.slug.toLowerCase() === needle || c.label.toLowerCase() === needle,
      );
      if (match) categoryId = match.id;
    }

    await db.motionLibrary.create({
      data: {
        text,
        categoryId,
        notes: typeof row.notes === "string" ? row.notes.trim() || null : null,
      },
    });
    created.push(text);
  }

  return NextResponse.json({ created: created.length, skipped: skipped.length });
}
