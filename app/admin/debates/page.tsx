export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import { DebateActions } from "./DebateActions";

export const metadata = { title: "Debates — Admin" };

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    ranked?: string;
    page?: string;
  }>;
}

const STATUS_OPTIONS = ["all", "pending", "active", "completed", "cancelled"];

export default async function AdminDebatesPage({ searchParams }: Props) {
  const {
    q = "",
    status = "all",
    category = "all",
    ranked = "all",
    page: pageStr = "1",
  } = await searchParams;

  const page = Math.max(1, parseInt(pageStr, 10));
  const limit = 30;

  const where: Record<string, unknown> = {};
  if (q) where.motion = { contains: q, mode: "insensitive" };
  if (status !== "all") where.status = status;
  if (category !== "all") where.categoryId = category;
  if (ranked === "yes") where.ranked = true;
  if (ranked === "no") where.ranked = false;

  const [debates, total, categories] = await Promise.all([
    db.debate.findMany({
      where,
      select: {
        id: true,
        motion: true,
        status: true,
        ranked: true,
        categoryId: true,
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

  function statusBadge(s: string) {
    if (s === "completed") return "bg-green-500/10 text-green-400 border-green-500/20";
    if (s === "active") return "bg-brand/10 text-brand border-brand/20";
    if (s === "cancelled") return "bg-danger/10 text-danger border-danger/20";
    return "bg-surface-overlay text-foreground-muted border-border";
  }

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ q, status, category, ranked, page: pageStr, ...overrides });
    return `/admin/debates?${params.toString()}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Debates</h1>
        <span className="text-sm text-foreground-muted">{total} total</span>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search motion…"
          className="text-sm rounded border border-border bg-background text-foreground px-3 py-1.5 w-60"
        />
        <select
          name="status"
          defaultValue={status}
          className="text-sm rounded border border-border bg-background text-foreground px-2 py-1.5"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={category}
          className="text-sm rounded border border-border bg-background text-foreground px-2 py-1.5"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
          ))}
        </select>
        <select
          name="ranked"
          defaultValue={ranked}
          className="text-sm rounded border border-border bg-background text-foreground px-2 py-1.5"
        >
          <option value="all">Ranked + Exhibition</option>
          <option value="yes">Ranked only</option>
          <option value="no">Exhibition only</option>
        </select>
        <button
          type="submit"
          className="px-3 py-1.5 text-sm rounded bg-brand text-white"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="rounded-[--radius] border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              {["Motion", "Category", "Debaters", "Status", "Ranked", "Date", "Actions"].map((h) => (
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
            {debates.map((d) => (
              <tr key={d.id} className="hover:bg-surface-raised/40 transition-colors">
                <td className="px-4 py-3 max-w-xs">
                  <Link
                    href={`/debates/${d.id}`}
                    className="text-foreground hover:text-brand line-clamp-2 text-xs"
                    target="_blank"
                  >
                    {d.motion}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-foreground-muted whitespace-nowrap">
                  {d.category.emoji} {d.category.label}
                </td>
                <td className="px-4 py-3 text-xs text-foreground-muted whitespace-nowrap">
                  <span className={d.winnerId === d.debaterA?.username ? "text-foreground font-medium" : ""}>
                    {d.debaterA?.username ?? "[deleted]"}
                  </span>
                  {" vs "}
                  <span className={d.winnerId === d.debaterB?.username ? "text-foreground font-medium" : ""}>
                    {d.debaterB?.username ?? "[deleted]"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${statusBadge(d.status)}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-foreground-muted">
                  {d.ranked ? "Yes" : "No"}
                </td>
                <td className="px-4 py-3 text-xs text-foreground-muted whitespace-nowrap">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <DebateActions
                    debate={{ id: d.id, motion: d.motion, categoryId: d.categoryId, status: d.status }}
                    categories={categories}
                  />
                </td>
              </tr>
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
