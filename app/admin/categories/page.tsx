import { db } from "@/lib/db";
import { CategoryRow } from "./CategoryRow";

export const metadata = { title: "Categories — Admin" };

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({ orderBy: { order: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Categories</h1>

      <div className="rounded-[--radius] border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              {["Category", "Slug", "Description", "Order", "Active"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((cat) => (
              <CategoryRow key={cat.id} cat={cat} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
