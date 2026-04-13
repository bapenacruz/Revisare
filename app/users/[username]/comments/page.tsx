import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username}'s Comments` };
}

export default async function UserCommentsPage({ params }: Props) {
  const { username } = await params;

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      showComments: true,
    },
  });

  if (!user) notFound();

  const comments = await db.debateComment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      content: true,
      createdAt: true,
      debate: {
        select: {
          challengeId: true,
          motion: true,
        },
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
          {user.username}&rsquo;s Comments
        </h1>
        <span className="text-sm text-foreground-muted">({comments.length})</span>
      </div>

      {comments.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-foreground-muted">
            No comments yet.
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <Link key={c.id} href={`/debates/${c.debate.challengeId}/results`}>
              <Card interactive>
                <CardBody className="py-3 px-4">
                  <p className="text-xs text-foreground-muted mb-1 line-clamp-1">
                    {c.debate.motion}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{c.content}</p>
                  <p className="text-xs text-foreground-subtle mt-1.5">
                    {new Date(c.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
