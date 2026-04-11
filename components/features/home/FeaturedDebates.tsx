import Link from "next/link";
import { Eye, Trophy } from "lucide-react";
import { FEATURED_DEBATES } from "@/lib/mock-data";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatCount } from "@/lib/utils";

export function FeaturedDebates() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-16">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-foreground">Featured Debates</h2>
        <Link
          href="/debates"
          className="text-sm text-brand hover:text-brand-hover transition-colors"
        >
          Browse all →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FEATURED_DEBATES.map((debate) => (
          <Link key={debate.id} href={`/debates/${debate.id}`}>
            <Card interactive className="h-full group">
              <CardBody className="flex flex-col gap-3 p-4">
                {/* Category + ranked */}
                <div className="flex items-center gap-2">
                  <Badge variant="default" size="sm">{debate.category}</Badge>
                  {debate.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                </div>

                {/* Motion */}
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-3">
                  {debate.motion}
                </p>

                {/* Participants */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Trophy size={11} className="text-accent shrink-0" />
                    <Avatar initial={debate.winner.avatarInitial} size="xs" />
                    <span>{debate.winner.username}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground-muted opacity-70">
                    <span className="w-[11px] shrink-0" />
                    <Avatar initial={debate.loser.avatarInitial} size="xs" />
                    <span>{debate.loser.username}</span>
                  </div>
                </div>

                {/* Audience vote */}
                <p className="text-xs text-foreground-subtle italic">
                  Audience: {debate.audienceVote}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-foreground-subtle pt-1 border-t border-border">
                  <span className="flex items-center gap-1">
                    <Eye size={12} />
                    {formatCount(debate.spectatorCount)}
                  </span>
                  <span>{debate.completedAgo}</span>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
