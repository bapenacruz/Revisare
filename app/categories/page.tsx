import { db } from "@/lib/db";
import { Card, CardBody } from "@/components/ui/Card";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      label: true,
      emoji: true,
      description: true,
      _count: { select: { debates: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Categories</h1>
        <p className="text-foreground-muted">
          Browse debate topics by category. Find live debates, open challenges, and past results.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link key={cat.slug} href={`/categories/${cat.slug}`}>
            <Card interactive className="h-full">
              <CardBody className="flex items-start gap-4 p-5">
                <span className="text-4xl">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground mb-1">{cat.label}</h2>
                  <p className="text-xs text-foreground-muted mb-3 line-clamp-2">{cat.description}</p>
                  <span className="text-xs text-foreground-subtle">
                    {cat._count.debates} debates
                  </span>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
