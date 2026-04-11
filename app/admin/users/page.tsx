export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import { UserActions } from "./UserActions";

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

  function roleBadge(role: string, suspendedUntil: Date | null) {
    if (role === "admin") return "bg-brand-dim text-brand border-brand/30";
    if (role === "banned") return "bg-danger/10 text-danger border-danger/30";
    if (role === "suspended" && suspendedUntil && suspendedUntil > new Date())
      return "bg-accent/10 text-accent border-accent/30";
    if (role === "exhibition") return "bg-surface-overlay text-foreground-muted border-border";
    return "bg-surface-overlay text-foreground-muted border-border";
  }

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
              {["Username", "Email", "Role", "ELO", "W/L", "Joined", "Actions"].map((h) => (
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
            {users.map((u) => {
              const isActuallySuspended =
                u.role === "suspended" &&
                u.suspendedUntil &&
                u.suspendedUntil > new Date();
              return (
                <tr
                  key={u.id}
                  className="bg-background hover:bg-surface transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/profile/${u.username}`} className="hover:text-brand">
                      {u.username}
                    </Link>
                    {u.isExhibition && (
                      <span className="ml-1.5 text-[10px] text-foreground-muted">[exhibition]</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs border capitalize ${roleBadge(u.role, u.suspendedUntil)}`}
                    >
                      {isActuallySuspended
                        ? `suspended until ${u.suspendedUntil!.toLocaleDateString()}`
                        : u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{u.elo}</td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {u.wins}W / {u.losses}L
                  </td>
                  <td className="px-4 py-3 text-foreground-muted whitespace-nowrap text-xs">
                    {u.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== "exhibition" && (
                      <UserActions
                        user={{
                          id: u.id,
                          username: u.username,
                          role: u.role,
                          suspendedUntil: u.suspendedUntil?.toISOString() ?? null,
                        }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
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
