import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { CategoryTabs } from "@/components/features/explore/CategoryTabs";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cat = await db.category.findUnique({ where: { slug: id }, select: { label: true } });
  return { title: cat?.label ?? "Category" };
}

export default async function CategoryDetailPage({ params }: Props) {
  const { id } = await params;

  const category = await db.category.findUnique({
    where: { slug: id },
    select: {
      id: true,
      label: true,
      emoji: true,
      description: true,
      challenges: {
        where: {
          status: "pending",
          type: "open",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          id: true,
          motion: true,
          ranked: true,
          format: true,
          creator: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      debates: {
        where: { status: "active", isPublic: true },
        select: {
          id: true,
          challengeId: true,
          motion: true,
          ranked: true,
          debaterA: { select: { username: true } },
          debaterB: { select: { username: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!category) notFound();

  const pastDebates = await db.debate.findMany({
    where: { categoryId: category.id, status: "completed", isPublic: true },
    select: {
      id: true,
      challengeId: true,
      motion: true,
      debaterA: { select: { username: true } },
      debaterB: { select: { username: true } },
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });

  return (
    <div>
      {/* Category header */}
      <div className="px-4 sm:px-6 py-6 flex items-center gap-4">
        <span className="text-4xl">{category.emoji}</span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{category.label}</h1>
          {category.description && (
            <p className="text-sm text-foreground-muted mt-0.5">{category.description}</p>
          )}
        </div>
      </div>

      <CategoryTabs
        live={category.debates}
        open={category.challenges}
        recent={pastDebates}
        categoryLabel={category.label}
      />
    </div>
  );
}