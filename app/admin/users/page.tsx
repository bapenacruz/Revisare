export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import { UserRow } from "./UserRow";
import type { Prisma } from "../../../generated/prisma/client/client";

export const metadata = { title: "Users — Admin" };

interface Props {
  searchParams: Promise<{
    q?: string;
    type?: string;       // "real" | "synthetic"
    status?: string;     // "active" | "suspended" | "banned" | "deleted"
    role?: string;       // "user" | "admin"
    joinedFrom?: string;
    joinedTo?: string;
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q = "", type = "", status = "", role = "", joinedFrom = "", joinedTo = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10));
  const limit = 30;

  const conditions: Prisma.UserWhereInput[] = [];

  // Text search
  if (q) {
    conditions.push({ OR: [{ username: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] });
  }

  // Type filter: synthetic = @placeholder.com
  if (type === "synthetic") {
    conditions.push({ email: { endsWith: "@placeholder.com" } });
  } else if (type === "real") {
    conditions.push({ NOT: { email: { endsWith: "@placeholder.com" } } });
  }

  // Status filter (admin is a role, not a status)
  const now = new Date();
  if (status === "deleted") {
    conditions.push({ isDeleted: true });
  } else if (status === "banned") {
    conditions.push({ isDeleted: false, role: "banned" });
  } else if (status === "suspended") {
    conditions.push({ isDeleted: false, role: "suspended", suspendedUntil: { gt: now } });
  } else if (status === "active") {
    conditions.push({ isDeleted: false, NOT: [{ role: "banned" }, { role: "suspended" }] });
  } else {
    // No status filter — default excludes deleted
    conditions.push({ isDeleted: false });
  }

  // Role filter
  if (role === "admin") {
    conditions.push({ role: "admin" });
  } else if (role === "user") {
    conditions.push({ role: "user" });
  }

  // Joined date range
  if (joinedFrom || joinedTo) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (joinedFrom) dateFilter.gte = new Date(joinedFrom);
    if (joinedTo) {
      const to = new Date(joinedTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }
    conditions.push({ createdAt: dateFilter });
  }

  const where: Prisma.UserWhereInput = conditions.length > 0 ? { AND: conditions } : {};

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
        hideFromLeaderboard: true,
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

  // Build query string for pagination links
  const qs = new URLSearchParams({ q, type, status, role, joinedFrom, joinedTo }).toString();

  const thInput = "w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground placeholder:text-foreground-subtle";
  const thSelect = "w-full h-7 px-1 text-xs rounded border border-border bg-background text-foreground";

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-4">
        Users
        <span className="text-base font-normal text-foreground-muted ml-2">({total})</span>
      </h1>

      <form method="GET">
        <div className="rounded-[--radius] border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              {/* Column labels */}
              <tr>
                {["Username", "Type", "Email", "Role", "Status", "ELO", "W/L", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
              {/* Filter row */}
              <tr className="border-b border-border bg-surface-raised">
                <th className="px-2 py-2 font-normal">
                  <input name="q" defaultValue={q} placeholder="Username / email…" className={thInput} />
                </th>
                <th className="px-2 py-2 font-normal">
                  <select name="type" defaultValue={type} className={thSelect}>
                    <option value="">All</option>
                    <option value="real">Real</option>
                    <option value="synthetic">Synthetic</option>
                  </select>
                </th>
                <th className="px-2 py-2 font-normal" />
                <th className="px-2 py-2 font-normal">
                  <select name="role" defaultValue={role} className={thSelect}>
                    <option value="">Any</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </th>
                <th className="px-2 py-2 font-normal">
                  <select name="status" defaultValue={status} className={thSelect}>
                    <option value="">Any</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </th>
                <th className="px-2 py-2 font-normal" />
                <th className="px-2 py-2 font-normal" />
                <th className="px-2 py-2 font-normal">
                  <div className="flex flex-col gap-1">
                    <input type="date" name="joinedFrom" defaultValue={joinedFrom} title="Joined from" className={thInput} />
                    <input type="date" name="joinedTo" defaultValue={joinedTo} title="Joined to" className={thInput} />
                  </div>
                </th>
                <th className="px-2 py-2 font-normal">
                  <div className="flex gap-1">
                    <button type="submit" className="h-7 px-3 text-xs rounded bg-brand text-white whitespace-nowrap">Filter</button>
                    <Link href="/admin/users" className="h-7 px-2 flex items-center text-xs rounded border border-border text-foreground-muted hover:text-foreground whitespace-nowrap">Reset</Link>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-foreground-muted text-sm">
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
      </form>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/users?${qs}&page=${p}`}
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
