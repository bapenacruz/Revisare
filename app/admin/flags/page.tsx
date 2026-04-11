import { db } from "@/lib/db";
import Link from "next/link";
import { FlagActions } from "./FlagActions";

export const metadata = { title: "Integrity Flags — Admin" };

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminFlagsPage({ searchParams }: Props) {
  const { status = "pending", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10));
  const limit = 25;

  const where = status === "all" ? {} : { status };

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Integrity Flags</h1>
        <div className="flex gap-2 text-sm">
          {["pending", "reviewed", "dismissed", "all"].map((s) => (
            <Link
              key={s}
              href={`/admin/flags?status=${s}`}
              className={`px-3 py-1 rounded-full border capitalize ${
                status === s
                  ? "border-brand bg-brand-dim text-brand"
                  : "border-border text-foreground-muted hover:text-foreground"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-[--radius] border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              {["Type", "Flagged User", "Reporter", "Description", "Date", "Action"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {enriched.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted text-sm">
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

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/flags?status=${status}&page=${p}`}
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
