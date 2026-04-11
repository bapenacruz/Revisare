export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardBody } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Categories" };

export default async function ExplorePage() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      label: true,
      emoji: true,
      description: true,
      _count: { select: { debates: { where: { isDeleted: false } } } },
    },
  });

  return (
    <div className="py-6 pb-4">
      <div className="px-4 sm:px-6 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Categories</h1>
      </div>

      <div className="px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/categories/${cat.slug}`}>
              <Card interactive className="h-full text-center">
                <CardBody className="flex flex-col items-center gap-2 px-3 py-4">
                  <span className="text-3xl">{cat.emoji}</span>
                  <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                  <span className="text-xs text-foreground-subtle">{cat._count.debates} debates</span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
