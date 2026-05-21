export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { CategoriesClient } from "./CategoriesClient";

export const metadata = { title: "Categories — Admin" };

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
  });
  const debateCounts = await db.debate.groupBy({
    by: ["categoryId"],
    where: { categoryId: { not: undefined }, status: { in: ["active", "completed"] }, isDeleted: false },
    _count: { _all: true },
  });
  const debateCountMap: Record<string, number> = {};
  for (const row of debateCounts) {
    if (row.categoryId) debateCountMap[row.categoryId] = row._count._all;
  }
  return <CategoriesClient initial={categories} debateCountMap={debateCountMap} />;
}
