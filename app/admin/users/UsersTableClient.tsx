"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRow } from "./UserRow";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  planType: string;
  isExhibition: boolean;
  isDeleted: boolean;
  hideFromLeaderboard: boolean;
  suspendedUntil: Date | null;
  elo: number;
  wins: number;
  losses: number;
  createdAt: Date;
  _count: { debaterA: number; debaterB: number };
}

export function UsersTableClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
    }
  }

  async function deleteSelected() {
    if (!confirm(`Soft-delete ${selected.size} user(s)? They will be marked as deleted.`)) return;
    setDeleting(true);
    setMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    setDeleting(false);
    if (res.ok) {
      setMsg(`Deleted ${selected.size} user(s) ✓`);
      setSelected(new Set());
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setMsg(data.error ?? "Delete failed");
    }
  }

  const allSelected = users.length > 0 && selected.size === users.length;

  return (
    <>
      <tbody className="divide-y divide-border">
        {users.length === 0 && (
          <tr>
            <td colSpan={13} className="px-4 py-8 text-center text-foreground-muted text-sm">
              No users found.
            </td>
          </tr>
        )}
        {users.map((u) => (
          <UserRow key={u.id} user={u} isSelected={selected.has(u.id)} onToggle={toggle} />
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={13} className="px-4 py-2.5 border-t border-border bg-surface-raised">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={toggleAll}
                className="text-xs text-brand hover:underline"
              >
                {allSelected ? "Deselect all" : `Select all ${users.length} on page`}
              </button>
              {selected.size > 0 && (
                <>
                  <span className="text-xs text-foreground-muted">
                    {selected.size} selected
                  </span>
                  <button
                    onClick={deleteSelected}
                    disabled={deleting}
                    className="px-3 py-1 text-xs rounded bg-danger text-white hover:bg-danger/80 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete Selected"}
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-foreground-muted hover:text-foreground"
                  >
                    Clear
                  </button>
                </>
              )}
              {msg && <span className="text-xs text-foreground-muted">{msg}</span>}
            </div>
          </td>
        </tr>
      </tfoot>
    </>
  );
}
