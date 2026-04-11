"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  debaterA: { username: string } | null;
  debaterB: { username: string } | null;
  winnerId: string | null;
  debaterAId: string;
  debaterBId: string;
}

function statusBadge(debate: Debate) {
  if (debate.isDeleted) return "bg-danger/10 text-danger border-danger/20";
  if (debate.isHidden) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (debate.status === "completed") return "bg-green-500/10 text-green-400 border-green-500/20";
  if (debate.status === "active") return "bg-brand/10 text-brand border-brand/20";
  if (debate.status === "cancelled") return "bg-danger/10 text-danger border-danger/20";
  return "bg-surface-overlay text-foreground-muted border-border";
}

function getDisplayStatus(debate: Debate) {
  if (debate.isDeleted) return "deleted";
  if (debate.isHidden) return "hidden";
  return debate.status;
}

export function DebateRow({
  debate,
  categories,
}: {
  debate: Debate;
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motion, setMotion] = useState(debate.motion);
  const [categoryId, setCategoryId] = useState(debate.categoryId);
  const [saving, setSaving] = useState(false);
  const [rejudging, setRejudging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localDeleted, setLocalDeleted] = useState(debate.isDeleted);
  const [localHidden, setLocalHidden] = useState(debate.isHidden);
  const [msg, setMsg] = useState<string | null>(null);

  const displayDebate = { ...debate, isDeleted: localDeleted, isHidden: localHidden };

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/debates/${debate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motion, categoryId }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Saved ✓");
      router.refresh();
    } else {
      const j = await res.json();
      setMsg(j.error ?? "Error");
    }
  }

  async function rejudge() {
    if (!confirm("Re-run AI judging? This will overwrite existing judge results.")) return;
    setRejudging(true);
    setMsg(null);
    const res = await fetch(`/api/admin/debates/${debate.id}/rejudge`, { method: "POST" });
    setRejudging(false);
    if (res.ok) {
      const j = await res.json();
      setMsg(j.message ?? "Judging started ✓ — refresh in ~60s");
      router.refresh();
    } else {
      const j = await res.json();
      setMsg(j.error ?? "Rejudge failed");
    }
  }

  async function hideDebate() {
    const newHiddenState = !localHidden;
    setHiding(true);
    setMsg(null);
    const res = await fetch(`/api/admin/debates/${debate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: newHiddenState }),
    });
    setHiding(false);
    if (res.ok) {
      setLocalHidden(newHiddenState);
      setMsg(newHiddenState ? "Debate hidden ✓" : "Debate unhidden ✓");
    } else {
      const j = await res.json();
      setMsg(j.error ?? "Hide/unhide failed");
    }
  }

  async function deleteDebate() {
    setDeleting(true);
    setMsg(null);
    const res = await fetch(`/api/admin/debates/${debate.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    setConfirmDelete(false);
    if (res.ok) {
      setLocalDeleted(true);
      setMsg("Debate deleted ✓");
    } else {
      const j = await res.json();
      setMsg(j.error ?? "Delete failed");
    }
  }

  return (
    <>
      <tr
        className={`transition-colors cursor-pointer ${open ? "bg-surface-raised" : "hover:bg-surface-raised/40"}`}
        onClick={() => { setOpen((v) => !v); setMsg(null); }}
      >
        <td className="px-4 py-3 max-w-xs">
          <Link
            href={`/debates/${debate.challengeId}`}
            className="text-foreground hover:text-brand line-clamp-2 text-xs"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
          >
            {debate.motion}
          </Link>
        </td>
        <td className="px-4 py-3 text-xs text-foreground-muted whitespace-nowrap">
          {debate.category.emoji} {debate.category.label}
        </td>
        <td className="px-4 py-3 text-xs text-foreground-muted whitespace-nowrap">
          <span className={debate.winnerId === debate.debaterAId ? "text-foreground font-medium" : ""}>
            {debate.debaterA?.username ?? "[deleted]"}
          </span>
          {" vs "}
          <span className={debate.winnerId === debate.debaterBId ? "text-foreground font-medium" : ""}>
            {debate.debaterB?.username ?? "[deleted]"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${statusBadge(displayDebate)}`}>
            {getDisplayStatus(displayDebate)}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-foreground-muted">
          {debate.ranked ? "Yes" : "No"}
        </td>
        <td className="px-4 py-3 text-xs text-foreground-muted whitespace-nowrap">
          {new Date(debate.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-xs text-brand">
          {open ? "▲ Close" : "▼ Edit"}
        </td>
      </tr>

      {open && (
        <tr className="bg-surface-raised border-t border-border">
          <td colSpan={7} className="px-6 py-4">
            <div className="flex flex-wrap gap-6 items-start">
              {/* Motion */}
              <div className="flex flex-col gap-1 flex-1 min-w-48">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Motion</label>
                <textarea
                  className="text-sm rounded border border-border bg-background text-foreground p-2 resize-none w-full"
                  rows={3}
                  value={motion}
                  onChange={(e) => setMotion(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1 w-52">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Category</label>
                <select
                  className="text-sm rounded border border-border bg-background text-foreground p-2"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 justify-end pt-5">
                <button
                  onClick={(e) => { e.stopPropagation(); save(); }}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm rounded bg-brand text-white disabled:opacity-50 whitespace-nowrap"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                {debate.status === "completed" && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); rejudge(); }}
                      disabled={rejudging}
                      className="px-4 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50 whitespace-nowrap"
                    >
                      {rejudging ? "Rejudging..." : "Re-run AI Judgement"}
                    </button>
                  </>
                )}

                {/* Hide/Unhide button */}
                {!localDeleted && (
                  <button
                    onClick={(e) => { e.stopPropagation(); hideDebate(); }}
                    disabled={hiding}
                    className={`px-4 py-1.5 text-sm rounded border disabled:opacity-50 whitespace-nowrap ${
                      localHidden 
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20" 
                        : "bg-surface border-border text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {hiding ? "Processing..." : localHidden ? "Unhide Debate" : "Hide Debate"}
                  </button>
                )}

                {/* Delete button */}
                {!localDeleted && (
                  !confirmDelete ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                      className="px-4 py-1.5 text-sm rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20"
                    >
                      Delete Debate
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteDebate(); }}
                        disabled={deleting}
                        className="px-4 py-1.5 text-sm rounded bg-danger text-white border-danger disabled:opacity-50"
                      >
                        {deleting ? "Deleting..." : "Confirm Delete"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                        className="px-4 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  )
                )}

                {localDeleted && (
                  <span className="text-sm text-foreground-muted italic">Debate deleted</span>
                )}

                {msg && <p className="text-xs text-foreground-muted">{msg}</p>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
