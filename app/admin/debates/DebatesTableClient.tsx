"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DebateRow } from "./DebateRow";

interface Category {
  id: string;
  label: string;
  emoji: string;
}

interface Debate {
  id: string;
  challengeId: string;
  motion: string;
  categoryId: string;
  status: string;
  ranked: boolean;
  isDeleted: boolean;
  isHidden: boolean;
  createdAt: Date;
  category: { label: string; emoji: string };
  debaterA: { username: string; email: string } | null;
  debaterB: { username: string; email: string } | null;
  winnerId: string | null;
  debaterAId: string;
  debaterBId: string;
  viewCount: number;
  _count: { debateComments: number; audienceVotes: number };
}

export function DebatesTableClient({
  debates,
  categories,
}: {
  debates: Debate[];
  categories: Category[];
}) {
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
    if (selected.size === debates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(debates.map((d) => d.id)));
    }
  }

  async function deleteSelected() {
    if (!confirm(`Soft-delete ${selected.size} debate(s)? They will be marked as deleted.`)) return;
    setDeleting(true);
    setMsg(null);
    const res = await fetch("/api/admin/debates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    setDeleting(false);
    if (res.ok) {
      setMsg(`Deleted ${selected.size} debate(s) ✓`);
      setSelected(new Set());
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setMsg(data.error ?? "Delete failed");
    }
  }

  const allSelected = debates.length > 0 && selected.size === debates.length;

  return (
    <>
      <tbody className="divide-y divide-border">
        {debates.map((d) => (
          <DebateRow
            key={d.id}
            debate={d}
            categories={categories}
            isSelected={selected.has(d.id)}
            onToggle={toggle}
          />
        ))}
        {debates.length === 0 && (
          <tr>
            <td colSpan={12} className="px-4 py-8 text-center text-sm text-foreground-muted">
              No debates found
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={12} className="px-4 py-2.5 border-t border-border bg-surface-raised">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={toggleAll}
                className="text-xs text-brand hover:underline"
              >
                {allSelected ? "Deselect all" : `Select all ${debates.length} on page`}
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
