export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [totalDebates, debatesToday, debatesThisMonth, debatesThisYear, totalUsers, topCategories] =
    await Promise.all([
      db.debate.count({ where: { isDeleted: false } }),
      db.debate.count({ where: { isDeleted: false, createdAt: { gte: startOfDay } } }),
      db.debate.count({ where: { isDeleted: false, createdAt: { gte: startOfMonth } } }),
      db.debate.count({ where: { isDeleted: false, createdAt: { gte: startOfYear } } }),
      db.user.count({ where: { isDeleted: false, isExhibition: false } }),
      db.category.findMany({
        where: { isActive: true },
        select: {
          label: true,
          emoji: true,
          _count: { select: { debates: true } },
        },
        orderBy: { debates: { _count: "desc" } },
        take: 6,
      }),
    ]);

  return NextResponse.json({
    totalDebates,
    debatesToday,
    debatesThisMonth,
    debatesThisYear,
    totalUsers,
    topCategories: topCategories.map((c) => ({
      label: c.label,
      emoji: c.emoji,
      count: c._count.debates,
    })),
  });
}
