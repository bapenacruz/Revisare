export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import { DebateRow } from "./DebateRow";
import { UploadDebates } from "./UploadDebates";

export const metadata = { title: "Debates — Admin" };

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    ranked?: string;
    deleted?: string;   // "true" | "false" (default "false")
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

const STATUS_OPTIONS = ["all", "pending", "active", "completed", "cancelled", "deleted", "hidden"];

export default async function AdminDebatesPage({ searchParams }: Props) {
  const {
    q = "",
    status = "all",
    category = "all",
    ranked = "all",
    deleted = "false",
    dateFrom = "",
    dateTo = "",
    page: pageStr = "1",
  } = await searchParams;

  const page = Math.max(1, parseInt(pageStr, 10));
  const limit = 30;

  const where: Record<string, unknown> = {};
  if (q) where.motion = { contains: q, mode: "insensitive" };
  
  // Handle status filtering with deleted/hidden logic
  if (status === "deleted") {
    where.isDeleted = true;
  } else if (status === "hidden") {
    where.isHidden = true;
    where.isDeleted = false; // hidden but not deleted
  } else if (status !== "all") {
    // Regular status + filter out deleted by default unless explicitly requested
    where.status = status;
    if (deleted !== "true") {
      where.isDeleted = false;
    }
  } else {
    // No specific status filter but apply deleted toggle
    if (deleted !== "true") {
      where.isDeleted = false;
    }
  }
  
  if (category !== "all") where.categoryId = category;
  if (ranked === "yes") where.ranked = true;
  if (ranked === "no") where.ranked = false;

  // Date range filter
  if (dateFrom || dateTo) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }
    where.createdAt = dateFilter;
  }

  const [debates, total, categories] = await Promise.all([
    db.debate.findMany({
      where,
      select: {
        id: true,
        challengeId: true,
        motion: true,
        status: true,
        ranked: true,
        categoryId: true,
        debaterAId: true,
        debaterBId: true,
        isDeleted: true,
        isHidden: true,
        category: { select: { label: true, emoji: true } },
        debaterA: { select: { username: true } },
        debaterB: { select: { username: true } },
        winnerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.debate.count({ where }),
    db.category.findMany({ orderBy: { order: "asc" }, select: { id: true, label: true, emoji: true } }),
  ]);

  const pages = Math.ceil(total / limit);

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ q, status, category, ranked, deleted, dateFrom, dateTo, page: pageStr, ...overrides });
    return `/admin/debates?${params.toString()}`;
  };

  const thInput = "w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground placeholder:text-foreground-subtle";
  const thSelect = "w-full h-7 px-1 text-xs rounded border border-border bg-background text-foreground";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Debates</h1>
        <span className="text-sm text-foreground-muted">{total} total</span>
      </div>

      {/* Bulk import */}
      <div className="mb-4">
        <UploadDebates />
      </div>

      {/* Table with inline column filters */}
      <form method="GET">
        <div className="rounded-[--radius] border border-border">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-surface border-b border-border">
              {/* Column labels */}
              <tr>
                {["Motion", "Category", "Debaters", "Status", "Ranked", "Date", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
              {/* Filter row */}
              <tr className="border-b border-border bg-surface-raised">
                <th className="px-2 py-2 font-normal">
                  <input name="q" defaultValue={q} placeholder="Search motion…" className={thInput} />
                </th>
                <th className="px-2 py-2 font-normal">
                  <select name="category" defaultValue={category} className={thSelect}>
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2 font-normal" />
                <th className="px-2 py-2 font-normal">
                  <select name="status" defaultValue={status} className={thSelect}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2 font-normal">
                  <select name="ranked" defaultValue={ranked} className={thSelect}>
                    <option value="all">All</option>
                    <option value="yes">Ranked</option>
                    <option value="no">Exhibition</option>
                  </select>
                </th>
                <th className="px-2 py-2 font-normal">
                  <div className="flex flex-col gap-1">
                    <input type="date" name="dateFrom" defaultValue={dateFrom} title="From" className={thInput} />
                    <input type="date" name="dateTo" defaultValue={dateTo} title="To" className={thInput} />
                  </div>
                  <input type="hidden" name="deleted" value={deleted} />
                </th>
                <th className="px-2 py-2 font-normal">
                  <div className="flex gap-1">
                    <button type="submit" className="h-7 px-3 text-xs rounded bg-brand text-white whitespace-nowrap">Filter</button>
                    <Link href="/admin/debates" className="h-7 px-2 flex items-center text-xs rounded border border-border text-foreground-muted hover:text-foreground whitespace-nowrap">Reset</Link>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {debates.map((d) => (
                <DebateRow key={d.id} debate={d} categories={categories} />
              ))}
              {debates.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-foreground-muted">
                    No debates found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          {page > 1 && (
            <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1 rounded border border-border text-foreground-muted hover:text-foreground">
              ← Prev
            </Link>
          )}
          <span className="text-foreground-muted">Page {page} of {pages}</span>
          {page < pages && (
            <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1 rounded border border-border text-foreground-muted hover:text-foreground">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
