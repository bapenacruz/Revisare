import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ad = await db.ad.findUnique({
    where: { id, isActive: true, isDeleted: false },
    select: {
      id: true,
      motion: true,
      businessName: true,
      proponentName: true,
      opponentName: true,
      officialResult: true,
      linkUrl: true,
      turns: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          speaker: true,
          roundName: true,
          content: true,
          order: true,
        },
      },
    },
  });

  if (!ad) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(ad);
}
