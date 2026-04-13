import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { FollowButton } from "@/components/features/profile/FollowButton";
import { MapPin, Trophy } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: username };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const session = await auth();

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      bio: true,
      country: true,
      region: true,
      elo: true,
      wins: true,
      losses: true,
      createdAt: true,
      isPrivate: true,
      followApproval: true,
      favCategories: {
        select: { category: { select: { id: true, label: true, emoji: true } } },
      },
      _count: { select: { followers: true, following: true, debateComments: true } },
    },
  });

  if (!user) notFound();

  // Is the logged-in user already following this profile?
  let isFollowing = false;
  let isPendingRequest = false;
  const isSelf = session?.user?.id === user.id;
  if (session?.user?.id && !isSelf) {
    const [follow, pendingReq] = await Promise.all([
      db.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: user.id,
          },
        },
        select: { followerId: true },
      }),
      db.followRequest.findUnique({
        where: {
          requesterId_targetId: {
            requesterId: session.user.id,
            targetId: user.id,
          },
        },
        select: { id: true },
      }),
    ]);
    isFollowing = !!follow;
    isPendingRequest = !isFollowing && !!pendingReq;
  }

  const recentDebates = await db.debate.findMany({
    where: {
      OR: [{ debaterAId: user.id }, { debaterBId: user.id }],
      isPublic: true,
      status: "completed",
    },
    orderBy: { completedAt: "desc" },
    take: 6,
    select: {
      id: true,
      challengeId: true,
      motion: true,
      ranked: true,
      winnerId: true,
      category: { select: { label: true, emoji: true } },
      debaterA: { select: { id: true, username: true } },
      debaterB: { select: { id: true, username: true } },
    },
  });

  const total = user.wins + user.losses;
  const winRate = total > 0 ? Math.round((user.wins / total) * 100) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      {/* Profile header */}
      <Card className="mb-6">
        <CardBody className="flex flex-col sm:flex-row items-center sm:items-start gap-5 py-6">
          <Avatar initial={user.username[0].toUpperCase()} size="xl" />

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
              <div>
                <h1 className="text-xl font-bold text-foreground">{user.username}</h1>
                {user.country && (
                  <p className="text-xs text-foreground-muted flex items-center justify-center sm:justify-start gap-1 mt-0.5">
                    <MapPin size={11} />
                    {[user.region, user.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              {!isSelf && session?.user && (
                <FollowButton username={user.username} initialFollowing={isFollowing} initialPending={isPendingRequest} />
              )}
              {!isSelf && !session?.user && (
                <Link
                  href="/auth/login"
                  className="text-xs text-brand hover:text-brand-hover font-medium"
                >
                  Sign in to follow
                </Link>
              )}
            </div>

            {user.bio && (
              <p className="text-sm text-foreground-muted leading-relaxed mb-3">{user.bio}</p>
            )}

            {/* Follower counts — lists only visible to followers on private profiles */}
            {(() => {
              const canSeeLists = isSelf || !user.isPrivate || isFollowing;
              const followersEl = canSeeLists ? (
                <Link href={`/users/${user.username}/followers`} className="hover:underline">
                  <span className="font-semibold text-foreground">{user._count.followers}</span>{" "}
                  <span className="text-foreground-muted">followers</span>
                </Link>
              ) : (
                <span>
                  <span className="font-semibold text-foreground">{user._count.followers}</span>{" "}
                  <span className="text-foreground-muted">followers</span>
                </span>
              );
              const followingEl = canSeeLists ? (
                <Link href={`/users/${user.username}/following`} className="hover:underline">
                  <span className="font-semibold text-foreground">{user._count.following}</span>{" "}
                  <span className="text-foreground-muted">following</span>
                </Link>
              ) : (
                <span>
                  <span className="font-semibold text-foreground">{user._count.following}</span>{" "}
                  <span className="text-foreground-muted">following</span>
                </span>
              );
              const commentsEl = canSeeLists ? (
                <Link href={`/users/${user.username}/comments`} className="hover:underline">
                  <span className="font-semibold text-foreground">{user._count.debateComments}</span>{" "}
                  <span className="text-foreground-muted">comments</span>
                </Link>
              ) : (
                <span>
                  <span className="font-semibold text-foreground">{user._count.debateComments}</span>{" "}
                  <span className="text-foreground-muted">comments</span>
                </span>
              );
              return (
                <div className="flex items-center justify-center sm:justify-start gap-4 text-sm mb-3">
                  {followersEl}
                  {followingEl}
                  {commentsEl}
                </div>
              );
            })()}

            {/* Stats */}
            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
              <Badge variant="brand" size="sm">
                <Trophy size={10} />
                {user.elo} ELO
              </Badge>
              <span className="text-xs text-success">{user.wins}W</span>
              <span className="text-xs text-danger">{user.losses}L</span>
              {winRate !== null && (
                <span className="text-xs text-foreground-muted">{winRate}% win rate</span>
              )}
            </div>

            {user.favCategories.length > 0 && (
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3">
                {user.favCategories.map((fc) => (
                  <Badge key={fc.category.id} variant="default" size="sm">
                    {fc.category.emoji} {fc.category.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Recent debates */}
      <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-widest mb-3">
        Recent Debates
      </h2>

      {recentDebates.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-foreground-muted">
            No public debates yet.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recentDebates.map((d) => {
            const won = d.winnerId === user.id;
            const lost = d.winnerId !== null && d.winnerId !== user.id;
            return (
              <Link key={d.id} href={`/debates/${d.challengeId}/results`}>
                <Card interactive className="h-full">
                  <CardBody className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="default" size="sm">
                        {d.category.emoji} {d.category.label}
                      </Badge>
                      {d.ranked && <Badge variant="brand" size="sm">Ranked</Badge>}
                      {won && <Badge variant="success" size="sm">Won</Badge>}
                      {lost && <Badge variant="danger" size="sm">Lost</Badge>}
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-3">
                      {d.motion}
                    </p>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
