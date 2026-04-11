export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { CategoriesClient } from "./CategoriesClient";

export const metadata = { title: "Categories — Admin" };

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { debates: true } } },
  });
  const debateCountMap: Record<string, number> = {};
  for (const c of categories) debateCountMap[c.id] = c._count.debates;
  return <CategoriesClient initial={categories} debateCountMap={debateCountMap} />;
}
