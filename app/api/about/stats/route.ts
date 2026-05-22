export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Only count debates that actually completed (not deleted, not cancelled, not still pending)
const ACTIVE_WHERE = { isDeleted: false, status: "completed" } as const;

export async function GET() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalDebates,
    debatesToday,
    debatesThisMonth,
    debatesThisYear,
    totalUsers,
    rankedDebates,
    totalViewsAgg,
    totalComments,
    totalVotes,
    topCategories,
  ] = await Promise.all([
    db.debate.count({ where: ACTIVE_WHERE }),
    db.debate.count({ where: { ...ACTIVE_WHERE, completedAt: { gte: startOfDay } } }),
    db.debate.count({ where: { ...ACTIVE_WHERE, completedAt: { gte: startOfMonth } } }),
    db.debate.count({ where: { ...ACTIVE_WHERE, completedAt: { gte: startOfYear } } }),
    db.user.count({ where: { isDeleted: false, isExhibition: false } }),
    db.debate.count({ where: { ...ACTIVE_WHERE, ranked: true } }),
    db.debate.aggregate({ where: ACTIVE_WHERE, _sum: { viewCount: true } }),
    db.debateComment.count(),
    db.audienceVote.count({ where: { debate: ACTIVE_WHERE } }),
    db.category.findMany({
      where: { isActive: true },
      select: {
        label: true,
        emoji: true,
        _count: {
          select: {
            debates: { where: ACTIVE_WHERE },
          },
        },
      },
      orderBy: { debates: { _count: "desc" } },
      take: 8,
    }),
  ]);

  // Re-sort after filtering since orderBy counts all debates
  const sorted = [...topCategories]
    .sort((a, b) => b._count.debates - a._count.debates)
    .filter((c) => c._count.debates > 0)
    .slice(0, 8);

  return NextResponse.json({
    totalDebates,
    debatesToday,
    debatesThisMonth,
    debatesThisYear,
    totalUsers,
    rankedDebates,
    totalViews: totalViewsAgg._sum.viewCount ?? 0,
    totalComments,
    totalVotes,
    topCategories: sorted.map((c) => ({
      label: c.label,
      emoji: c.emoji,
      count: c._count.debates,
    })),
  });
}
