export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import { UserRow } from "./UserRow";

export const metadata = { title: "Users — Admin" };

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10));
  const limit = 30;

  const where = q
    ? { OR: [{ username: { contains: q } }, { email: { contains: q } }] }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isExhibition: true,
        isDeleted: true,
        suspendedUntil: true,
        elo: true,
        wins: true,
        losses: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Users
          <span className="text-base font-normal text-foreground-muted ml-2">({total})</span>
        </h1>
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search username or email…"
            className="h-9 px-3 text-sm rounded-[--radius] border border-border bg-background text-foreground w-60"
          />
          <button
            type="submit"
            className="h-9 px-4 text-sm rounded-[--radius] bg-brand text-white"
          >
            Search
          </button>
        </form>
      </div>

      <div className="rounded-[--radius] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              {["Username", "Email", "Status", "ELO", "W/L", "Joined", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-foreground-muted text-sm">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/users?q=${encodeURIComponent(q)}&page=${p}`}
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
