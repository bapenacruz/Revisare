import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { EditProfileForm } from "@/components/features/profile/EditProfileForm";
import { AssessmentSection } from "@/components/features/profile/AssessmentSection";
import { FollowList } from "@/components/features/profile/FollowList";
import { MapPin } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const [user, categories, followersData, followingData] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        bio: true,
        avatarUrl: true,
        country: true,
        twitterHandle: true,
        threadsHandle: true,
        truthSocialHandle: true,
        blueskyHandle: true,
        mastodonHandle: true,
        websiteUrl: true,
        lastUsernameChange: true,
        dob: true,
        gender: true,
        region: true,
        createdAt: true,
        aiAssessment: true,
        aiAssessmentUpdatedAt: true,
        favCategories: {
          select: {
            category: {
              select: { id: true, slug: true, label: true, emoji: true },
            },
          },
        },
      },
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, slug: true, label: true, emoji: true },
    }),
    db.follow.findMany({
      where: { followingId: session.user.id },
      select: { follower: { select: { id: true, username: true, elo: true, country: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.follow.findMany({
      where: { followerId: session.user.id },
      select: { following: { select: { id: true, username: true, elo: true, country: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) redirect("/auth/login");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="md:w-64 shrink-0">
          <div className="flex flex-col items-center text-center gap-3 py-6">
              <Avatar
                initial={user.username.charAt(0).toUpperCase()}
                size="xl"
              />
              <div>
                <h1 className="text-lg font-bold text-foreground">{user.username}</h1>
                {user.country && (
                  <p className="text-xs text-foreground-muted flex items-center justify-center gap-1 mt-1">
                    <MapPin size={11} />
                    {user.country}
                  </p>
                )}
              </div>
              {user.bio && (
                <p className="text-sm text-foreground-muted leading-relaxed">{user.bio}</p>
              )}
              {user.favCategories.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {user.favCategories.map((fc) => (
                    <Badge key={fc.category.id} variant="default" size="sm">
                      {fc.category.emoji} {fc.category.label}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-foreground-subtle">
                Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          <Tabs defaultTab="following">
            <TabList className="flex-nowrap w-full [&>button]:flex-1 [&>button]:px-1 [&>button]:text-center [&>button]:text-xs">
              <TabTrigger id="following">
                Following
                {followingData.length > 0 && (
                  <span className="ml-1 text-[10px] text-foreground-subtle">({followingData.length})</span>
                )}
              </TabTrigger>
              <TabTrigger id="followers">
                Followers
                {followersData.length > 0 && (
                  <span className="ml-1 text-[10px] text-foreground-subtle">({followersData.length})</span>
                )}
              </TabTrigger>
              <TabTrigger id="assessment">Assessment</TabTrigger>
              <TabTrigger id="edit">Edit Profile</TabTrigger>
            </TabList>

            <TabPanel id="following">
              <FollowList
                users={followingData.map((f) => f.following)}
                emptyMessage="You're not following anyone yet."
              />
            </TabPanel>

            <TabPanel id="followers">
              <FollowList
                users={followersData.map((f) => f.follower)}
                emptyMessage="No followers yet."
              />
            </TabPanel>

            <TabPanel id="edit">
              <Card>
                <CardBody>
                  <EditProfileForm
                    initial={user}
                    allCategories={categories}
                  />
                </CardBody>
              </Card>
            </TabPanel>

            <TabPanel id="assessment">
              <AssessmentSection
                assessment={user.aiAssessment}
                updatedAt={user.aiAssessmentUpdatedAt}
              />
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
