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
  return { title: `${username} is Following` };
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      isPrivate: true,
    },
  });

  if (!user) notFound();

  // Gate: private profiles only show this list to their followers
  const session = await import("@/lib/auth").then((m) => m.auth());
  const viewerId = session?.user?.id;
  if (user.isPrivate && viewerId !== user.id) {
    const isFollower = viewerId
      ? !!(await db.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
          select: { followerId: true },
        }))
      : false;
    if (!isFollower) {
      return (
        <div className="mx-auto max-w-xl px-4 sm:px-6 py-20 text-center">
          <p className="text-foreground-muted">This profile is private.</p>
        </div>
      );
    }
  }

  const following = await db.follow.findMany({
    where: { followerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      following: {
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
          {user.username}&rsquo;s Following
        </h1>
        <span className="text-sm text-foreground-muted">({following.length})</span>
      </div>

      {following.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-foreground-muted">
            Not following anyone yet.
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {following.map(({ following: f }) => (
            <Link key={f.id} href={`/users/${f.username}`}>
              <Card interactive>
                <CardBody className="flex items-center gap-3 py-3 px-4">
                  <Avatar initial={f.username[0].toUpperCase()} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{f.username}</p>
                    {f.country && (
                      <p className="text-xs text-foreground-muted">{f.country}</p>
                    )}
                  </div>
                  <span className="text-xs text-foreground-muted">{f.elo} ELO</span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
