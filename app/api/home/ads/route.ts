import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const ads = await db.ad.findMany({
    where: { isActive: true, isDeleted: false },
    select: {
      id: true,
      motion: true,
      proponentName: true,
      opponentName: true,
      linkUrl: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(ads);
}
