import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, label: true, emoji: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(categories);
}
