export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { CategoriesClient } from "./CategoriesClient";

export const metadata = { title: "Categories — Admin" };

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({ orderBy: { order: "asc" } });
  return <CategoriesClient initial={categories} />;
}
