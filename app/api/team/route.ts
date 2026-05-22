import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [members, settings] = await Promise.all([
    db.teamMember.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, role: true, description: true, imageDataUrl: true },
    }),
    db.teamSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  return NextResponse.json({
    introText: settings?.introText ?? "Revisare is built by a small team passionate about structured thinking, rhetoric, and AI.",
    members,
  });
}
