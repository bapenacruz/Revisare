import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Trophy } from "lucide-react";

export async function FeaturedUsers() {
  const users = await db.user.findMany({
    orderBy: { elo: "desc" },
    take: 6,
    select: {
      id: true,
      username: true,
      elo: true,
      wins: true,
      losses: true,
      avatarUrl: true,
      bio: true,
    },
  });

  if (users.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-12">
      <div className="flex items-center gap-3 mb-5">
        <Trophy size={18} className="text-accent" />
        <h2 className="text-xl font-bold text-foreground">Top Debaters</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {users.map((user, i) => (
          <Link key={user.id} href={`/users/${user.username}`}>
            <Card interactive className="h-full">
              <CardBody className="flex items-start gap-3 p-4">
                <div className="relative shrink-0">
                  <Avatar initial={user.username[0].toUpperCase()} size="md" />
                  {i < 3 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{user.username}</p>
                  {user.bio && (
                    <p className="text-xs text-foreground-muted line-clamp-1 mt-0.5">{user.bio}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="brand" size="sm">{user.elo} ELO</Badge>
                    <span className="text-xs text-foreground-subtle">
                      {user.wins}W · {user.losses}L
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
