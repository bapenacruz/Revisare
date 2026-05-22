export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import { AdRow } from "./AdRow";
import { AdCategoryRow } from "./AdCategoryRow";
import { CreateAdForm } from "./CreateAdForm";
import { CreateAdCategoryForm } from "./CreateAdCategoryForm";

export const metadata = { title: "Ads — Admin" };

interface Props {
  searchParams: Promise<{ q?: string; category?: string; active?: string; page?: string }>;
}

export default async function AdminAdsPage({ searchParams }: Props) {
  const { q = "", category = "all", active = "all", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10));
  const limit = 30;

  const where: Record<string, unknown> = { isDeleted: false };
  if (q) where.motion = { contains: q, mode: "insensitive" };
  if (category !== "all") where.categoryId = category;
  if (active === "yes") where.isActive = true;
  if (active === "no") where.isActive = false;

  const [ads, total, adCategories] = await Promise.all([
    db.ad.findMany({
      where,
      include: { category: { select: { label: true, emoji: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.ad.count({ where }),
    db.adCategory.findMany({ orderBy: { order: "asc" } }),
  ]);

  const pages = Math.ceil(total / limit);

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ q, category, active, page: pageStr, ...overrides });
    return `/admin/ads?${params}`;
  };

  const thInput = "w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground placeholder:text-foreground-subtle";
  const thSelect = "w-full h-7 px-1 text-xs rounded border border-border bg-background text-foreground";

  return (
    <div className="space-y-12">
      {/* ── Section 1: Ads ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">Ads</h1>
          <span className="text-sm text-foreground-muted">{total} total</span>
        </div>

        <CreateAdForm categories={adCategories} />

        <form method="GET">
          <div className="rounded-[--radius] border border-border overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {["Motion", "Proponent", "Opponent", "Category", "Link", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="px-2 py-2 font-normal">
                    <input name="q" defaultValue={q} placeholder="Search motion…" className={thInput} />
                  </th>
                  <th className="px-2 py-2 font-normal" />
                  <th className="px-2 py-2 font-normal" />
                  <th className="px-2 py-2 font-normal">
                    <select name="category" defaultValue={category} className={thSelect}>
                      <option value="all">All</option>
                      {adCategories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                    </select>
                  </th>
                  <th className="px-2 py-2 font-normal" />
                  <th className="px-2 py-2 font-normal">
                    <select name="active" defaultValue={active} className={thSelect}>
                      <option value="all">All</option>
                      <option value="yes">Active</option>
                      <option value="no">Inactive</option>
                    </select>
                  </th>
                  <th className="px-2 py-2 font-normal" />
                  <th className="px-2 py-2 font-normal">
                    <div className="flex gap-1">
                      <button type="submit" className="h-7 px-3 text-xs rounded bg-brand text-white whitespace-nowrap">Filter</button>
                      <Link href="/admin/ads" className="h-7 px-2 flex items-center text-xs rounded border border-border text-foreground-muted hover:text-foreground">Reset</Link>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ads.map((ad) => (
                  <AdRow key={ad.id} ad={ad} categories={adCategories} />
                ))}
                {ads.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-foreground-muted">No ads found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </form>

        {pages > 1 && (
          <div className="flex items-center gap-2 mt-4 text-sm">
            {page > 1 && <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1 rounded border border-border text-foreground-muted hover:text-foreground">← Prev</Link>}
            <span className="text-foreground-muted">Page {page} of {pages}</span>
            {page < pages && <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1 rounded border border-border text-foreground-muted hover:text-foreground">Next →</Link>}
          </div>
        )}
      </section>

      {/* ── Section 2: Ad Categories ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Ad Categories</h2>
          <span className="text-sm text-foreground-muted">{adCategories.length} total</span>
        </div>

        <CreateAdCategoryForm />

        <div className="rounded-[--radius] border border-border overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                {["Emoji", "Slug", "Label", "Order", "Active", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adCategories.map((cat) => (
                <AdCategoryRow key={cat.id} cat={cat} />
              ))}
              {adCategories.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-foreground-muted">No ad categories yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
