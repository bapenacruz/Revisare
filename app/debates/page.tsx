export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import { Eye, Sword } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Debates" };
export const revalidate = 30;

export default async function DebatesPage() {
  const [liveDebates, recentDebates, openChallenges] = await Promise.all([
    db.debate.findMany({
      where: { status: "active", isPublic: true },
      include: {
        category: { select: { label: true, emoji: true } },
        debaterA: { select: { username: true } },
        debaterB: { select: { username: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 6,
    }),
    db.debate.findMany({
      where: { status: "completed", isPublic: true },
      include: {
        category: { select: { label: true, emoji: true } },
        debaterA: { select: { username: true } },
        debaterB: { select: { username: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 6,
    }),
    db.challenge.findMany({
      where: { status: "pending", type: "open" },
      include: {
        category: { select: { label: true, emoji: true } },
        creator: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Debates</h1>
          <p className="text-foreground-muted">Browse live debates and open challenges.</p>
        </div>
        <Link
          href="/challenges/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[--radius] bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-md shadow-brand/20"
        >
          <Sword size={14} />
          New Challenge
        </Link>
      </div>

      {/* Live */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Live Now</h2>
          <Badge variant="live">LIVE</Badge>
        </div>
        {liveDebates.length === 0 ? (
          <p className="text-foreground-muted text-sm">No live debates at the moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {liveDebates.map((d) => (
              <Link key={d.id} href={`/debates/${d.challengeId}`}>
                <Card interactive>
                  <CardBody className="flex flex-col gap-2.5 p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="default" size="sm">{d.category.emoji} {d.category.label}</Badge>
                      <Badge variant="live" size="sm">LIVE</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground line-clamp-2">{d.motion}</p>
                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                      <Avatar initial={d.debaterA.username[0].toUpperCase()} size="xs" />
                      {d.debaterA.username}
                      <span className="font-bold text-foreground-subtle">VS</span>
                      <Avatar initial={d.debaterB.username[0].toUpperCase()} size="xs" />
                      {d.debaterB.username}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-foreground-subtle">
                      <Eye size={11} />
                      Spectators welcome
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Open challenges */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Open Challenges</h2>
          <Link href="/challenges/new" className="text-sm text-brand hover:underline">Post one</Link>
        </div>
        {openChallenges.length === 0 ? (
          <p className="text-foreground-muted text-sm">No open challenges right now. <Link href="/challenges/new" className="text-brand hover:underline">Be the first!</Link></p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {openChallenges.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}/lobby`}>
                <Card interactive>
                  <CardBody className="flex flex-col gap-2.5 p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="default" size="sm">{c.category.emoji} {c.category.label}</Badge>
                      <Badge variant={c.ranked ? "accent" : "default"} size="sm">
                        {c.ranked ? "Ranked" : "Unranked"}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground line-clamp-2">{c.motion}</p>
                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                      <Avatar initial={c.creator.username[0].toUpperCase()} size="xs" />
                      {c.creator.username}
                      <span className="ml-auto text-foreground-subtle">
                        {c.format === "quick" ? "Quick" : "Standard"}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent results */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Results</h2>
        {recentDebates.length === 0 ? (
          <p className="text-foreground-muted text-sm">No completed debates yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentDebates.map((d) => (
              <Link key={d.id} href={`/debates/${d.challengeId}`}>
                <Card interactive>
                  <CardBody className="flex flex-col gap-2.5 p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" size="sm">{d.category.emoji} {d.category.label}</Badge>
                      {d.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                    </div>
                    <p className="text-sm font-medium text-foreground line-clamp-2">{d.motion}</p>
                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                      <Avatar initial={d.debaterA.username[0].toUpperCase()} size="xs" />
                      {d.debaterA.username}
                      <span className="text-foreground-subtle">vs</span>
                      <Avatar initial={d.debaterB.username[0].toUpperCase()} size="xs" />
                      {d.debaterB.username}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

