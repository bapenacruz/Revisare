import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

// GET /api/admin/team/settings
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.teamSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    introText: settings?.introText ?? "Revisare is built by a small team passionate about structured thinking, rhetoric, and AI.",
  });
}

// PUT /api/admin/team/settings
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.introText !== "string") {
    return NextResponse.json({ error: "Missing introText" }, { status: 400 });
  }

  const settings = await db.teamSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", introText: body.introText },
    update: { introText: body.introText },
  });

  return NextResponse.json({ introText: settings.introText });
}
