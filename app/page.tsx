export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Hero } from "@/components/features/home/Hero";
import { HomeTabs } from "@/components/features/home/HomeTabs";
import { db } from "@/lib/db";

const PAGE_SIZE = 12;

export default async function HomePage() {
  const [liveRows, liveCount] = await Promise.all([
    db.debate.findMany({
      where: { status: "active" },
      orderBy: { startedAt: "desc" },
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        challengeId: true,
        motion: true,
        ranked: true,
        debaterA: { select: { username: true } },
        debaterB: { select: { username: true } },
        category: { select: { label: true, emoji: true } },
      },
    }),
    db.debate.count({ where: { status: "active" } }),
  ]);

  const hasMore = liveRows.length > PAGE_SIZE;
  const initialLive = hasMore ? liveRows.slice(0, PAGE_SIZE) : liveRows;
  const initialLiveCursor = hasMore ? initialLive[initialLive.length - 1].id : null;

  return (
    <>
      <Suspense fallback={null}><Hero /></Suspense>
      <HomeTabs
        liveCount={liveCount}
        initialLive={initialLive}
        initialLiveCursor={initialLiveCursor}
      />
    </>
  );
}
