import Link from "next/link";
import { Radio } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

export async function LiveDebates() {
  const debates = await db.debate.findMany({
    where: { status: "active" },
    orderBy: { startedAt: "desc" },
    take: 6,
    select: {
      id: true,
      challengeId: true,
      motion: true,
      ranked: true,
      debaterA: { select: { username: true } },
      debaterB: { select: { username: true } },
      category: { select: { label: true } },
    },
  });

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 mb-16">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">Live Now</h2>
          <Badge variant="live">LIVE</Badge>
        </div>
        <Link
          href="/debates"
          className="text-sm text-brand hover:text-brand-hover transition-colors"
        >
          View all →
        </Link>
      </div>

      {debates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-foreground-muted">
          <Radio size={32} className="mb-3 opacity-30" />
          <p className="text-sm">No live debates right now — check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {debates.map((debate) => (
            <Link key={debate.id} href={`/debates/${debate.challengeId}`}>
              <Card interactive className="h-full">
                <CardBody className="flex flex-col gap-3 p-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <Badge variant="default" size="sm">
                      {debate.category.label}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="live" size="sm">LIVE</Badge>
                      {debate.ranked && (
                        <Badge variant="brand" size="sm">Ranked</Badge>
                      )}
                    </div>
                  </div>

                  {/* Motion */}
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                    {debate.motion}
                  </p>

                  {/* Participants */}
                  <div className="flex flex-col gap-1">
                    {[debate.debaterA, debate.debaterB].map((p) => (
                      <div key={p.username} className="flex items-center gap-1.5 text-xs text-foreground-muted">
                        <Avatar initial={p.username[0].toUpperCase()} size="xs" />
                        <span>{p.username}</span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
