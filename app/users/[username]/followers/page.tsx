import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody } from "@/components/ui/Card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username}'s Followers` };
}

export default async function FollowersPage({ params }: Props) {
  const { username } = await params;

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      showFollowers: true,
    },
  });

  if (!user) notFound();

  const followers = await db.follow.findMany({
    where: { followingId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      follower: {
        select: { id: true, username: true, country: true, elo: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/users/${username}`}
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-foreground">
          {user.username}&rsquo;s Followers
        </h1>
        <span className="text-sm text-foreground-muted">({followers.length})</span>
      </div>

      {followers.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-foreground-muted">
            No followers yet.
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {followers.map(({ follower }) => (
            <Link key={follower.id} href={`/users/${follower.username}`}>
              <Card interactive>
                <CardBody className="flex items-center gap-3 py-3 px-4">
                  <Avatar initial={follower.username[0].toUpperCase()} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{follower.username}</p>
                    {follower.country && (
                      <p className="text-xs text-foreground-muted">{follower.country}</p>
                    )}
                  </div>
                  <span className="text-xs text-foreground-muted">{follower.elo} ELO</span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
