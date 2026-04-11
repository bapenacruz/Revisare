export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import { UserRow } from "./UserRow";
import type { Prisma } from "../../../generated/prisma/client/client";

export const metadata = { title: "Users — Admin" };

interface Props {
  searchParams: Promise<{
    q?: string;
    type?: string;   // "real" | "synthetic"
    status?: string; // "active" | "admin" | "suspended" | "banned" | "deleted"
    role?: string;   // "user" | "admin"
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q = "", type = "", status = "", role = "", page: pageStr = "1" } = await searchParams;
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

  // Status filter
  const now = new Date();
  if (status === "deleted") {
    conditions.push({ isDeleted: true });
  } else if (status === "banned") {
    conditions.push({ isDeleted: false, role: "banned" });
  } else if (status === "suspended") {
    conditions.push({ isDeleted: false, role: "suspended", suspendedUntil: { gt: now } });
  } else if (status === "admin") {
    conditions.push({ isDeleted: false, role: "admin" });
  } else if (status === "active") {
    conditions.push({ isDeleted: false, NOT: [{ role: "banned" }, { role: "suspended" }, { role: "admin" }] });
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
  const qs = new URLSearchParams({ q, type, status, role }).toString();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          Users
          <span className="text-base font-normal text-foreground-muted ml-2">({total})</span>
        </h1>

        <form method="GET" className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground-muted uppercase tracking-wide font-medium">Search</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="Username or email..."
              className="h-8 px-3 text-sm rounded-[--radius] border border-border bg-background text-foreground w-52"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground-muted uppercase tracking-wide font-medium">Type</label>
            <select name="type" defaultValue={type} className="h-8 px-2 text-sm rounded-[--radius] border border-border bg-background text-foreground">
              <option value="">All</option>
              <option value="real">Real</option>
              <option value="synthetic">Synthetic</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground-muted uppercase tracking-wide font-medium">Status</label>
            <select name="status" defaultValue={status} className="h-8 px-2 text-sm rounded-[--radius] border border-border bg-background text-foreground">
              <option value="">Any</option>
              <option value="active">Active</option>
              <option value="admin">Admin</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-foreground-muted uppercase tracking-wide font-medium">Role</label>
            <select name="role" defaultValue={role} className="h-8 px-2 text-sm rounded-[--radius] border border-border bg-background text-foreground">
              <option value="">Any</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          <button type="submit" className="h-8 px-4 text-sm rounded-[--radius] bg-brand text-white self-end">
            Filter
          </button>
          <Link href="/admin/users" className="h-8 px-3 flex items-center text-sm rounded-[--radius] border border-border text-foreground-muted hover:text-foreground self-end">
            Reset
          </Link>
        </form>
      </div>

      <div className="rounded-[--radius] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              {["Username", "Type", "Email", "Role", "Status", "ELO", "W/L", "Joined", "Actions"].map((h) => (
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
