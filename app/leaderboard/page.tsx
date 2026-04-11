export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/features/profile/LeaderboardTable";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leaderboard" };
export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{ cat?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const { cat } = await searchParams;

  const [players, categories] = await Promise.all([
    db.user.findMany({
      where: {
        isDeleted: false,
        hideFromLeaderboard: false,
        ...(cat
          ? {
              OR: [
                { debaterA: { some: { category: { slug: cat } } } },
                { debaterB: { some: { category: { slug: cat } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        username: true,
        elo: true,
        wins: true,
        losses: true,
        country: true,
      },
      orderBy: { elo: "desc" },
      take: 200,
    }),
    db.category.findMany({
      where: { isActive: true },
      select: { id: true, label: true, emoji: true, slug: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-foreground mb-6">Leaderboard</h1>
      <Suspense>
        <LeaderboardTable players={players} categories={categories} />
      </Suspense>
    </div>
  );
}
