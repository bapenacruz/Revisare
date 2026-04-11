export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import { FlagActions } from "./FlagActions";

export const metadata = { title: "Integrity Flags — Admin" };

interface Props {
  searchParams: Promise<{
    status?: string;
    type?: string;
    flaggedUser?: string;
    reporter?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

export default async function AdminFlagsPage({ searchParams }: Props) {
  const { status = "pending", type = "", flaggedUser = "", reporter = "", dateFrom = "", dateTo = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10));
  const limit = 25;

  // Build conditions
  const conditions: Record<string, unknown>[] = [];
  if (status !== "all") conditions.push({ status });
  if (type) conditions.push({ type: { contains: type, mode: "insensitive" } });
  if (dateFrom || dateTo) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }
    conditions.push({ createdAt: dateFilter });
  }

  // Resolve flaggedUser text to userId first
  let flaggedUserId: string | undefined;
  if (flaggedUser) {
    const found = await db.user.findFirst({
      where: { username: { contains: flaggedUser, mode: "insensitive" } },
      select: { id: true },
    });
    if (found) {
      conditions.push({ userId: found.id });
      flaggedUserId = found.id;
    } else {
      // No match — return empty
      conditions.push({ userId: "__no_match__" });
    }
  }
  void flaggedUserId;

  // Resolve reporter text to userId
  if (reporter) {
    const found = await db.user.findFirst({
      where: { username: { contains: reporter, mode: "insensitive" } },
      select: { id: true },
    });
    if (found) {
      conditions.push({ reporterId: found.id });
    } else {
      conditions.push({ reporterId: "__no_match__" });
    }
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [flags, total] = await Promise.all([
    db.integrityFlag.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.integrityFlag.count({ where }),
  ]);

  const userIds = [
    ...new Set(
      flags.flatMap((f) => [f.userId, f.reporterId].filter(Boolean) as string[]),
    ),
  ];
  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true },
        })
      : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.username]));

  const enriched = flags.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    flaggedUsername: f.userId ? (userMap[f.userId] ?? f.userId) : null,
    reporterUsername: f.reporterId ? (userMap[f.reporterId] ?? f.reporterId) : null,
  }));

  const pages = Math.ceil(total / limit);
  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ status, type, flaggedUser, reporter, dateFrom, dateTo, page: pageStr, ...overrides });
    return `/admin/flags?${params.toString()}`;
  };

  const thInput = "w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground placeholder:text-foreground-subtle";
  const thSelect = "w-full h-7 px-1 text-xs rounded border border-border bg-background text-foreground";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Integrity Flags</h1>
        <span className="text-sm text-foreground-muted">{total} total</span>
      </div>

      <form method="GET">
        <div className="rounded-[--radius] border border-border">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-surface border-b border-border">
              {/* Column labels */}
              <tr>
                {["Type", "Flagged User", "Reporter", "Description", "Status", "Date", "Action"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
              {/* Filter row */}
              <tr className="border-b border-border bg-surface-raised">
                <th className="px-2 py-2 font-normal">
                  <input name="type" defaultValue={type} placeholder="Filter type…" className={thInput} />
                </th>
                <th className="px-2 py-2 font-normal">
                  <input name="flaggedUser" defaultValue={flaggedUser} placeholder="Username…" className={thInput} />
                </th>
                <th className="px-2 py-2 font-normal">
                  <input name="reporter" defaultValue={reporter} placeholder="Username…" className={thInput} />
                </th>
                <th className="px-2 py-2 font-normal" />
                <th className="px-2 py-2 font-normal">
                  <select name="status" defaultValue={status} className={thSelect}>
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </th>
                <th className="px-2 py-2 font-normal">
                  <div className="flex flex-col gap-1">
                    <input type="date" name="dateFrom" defaultValue={dateFrom} title="From" className={thInput} />
                    <input type="date" name="dateTo" defaultValue={dateTo} title="To" className={thInput} />
                  </div>
                </th>
                <th className="px-2 py-2 font-normal">
                  <div className="flex gap-1">
                    <button type="submit" className="h-7 px-3 text-xs rounded bg-brand text-white whitespace-nowrap">Filter</button>
                    <Link href="/admin/flags" className="h-7 px-2 flex items-center text-xs rounded border border-border text-foreground-muted hover:text-foreground whitespace-nowrap">Reset</Link>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enriched.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-foreground-muted text-sm">
                    No flags found.
                  </td>
                </tr>
              )}
              {enriched.map((f) => (
                <tr key={f.id} className="bg-background hover:bg-surface transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground capitalize">
                    {f.type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {f.flaggedUsername ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {f.reporterUsername ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted max-w-xs truncate">
                    {f.description ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${
                      f.status === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                      f.status === "reviewed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                      "bg-surface-overlay text-foreground-muted border-border"
                    }`}>{f.status}</span>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted whitespace-nowrap">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {f.debateId && (
                        <Link
                          href={`/debates/${f.debateId}`}
                          className="text-xs text-foreground-muted hover:text-brand"
                          target="_blank"
                        >
                          View
                        </Link>
                      )}
                      <FlagActions flag={f} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildUrl({ page: String(p) })}
              className={`w-8 h-8 flex items-center justify-center rounded text-sm ${
                p === page
                  ? "bg-brand text-white"
                  : "bg-surface border border-border text-foreground-muted hover:text-foreground"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
