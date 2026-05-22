"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AdCategory {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  order: number;
  isActive: boolean;
}

export function AdCategoryRow({ cat }: { cat: AdCategory }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(cat.slug);
  const [label, setLabel] = useState(cat.label);
  const [emoji, setEmoji] = useState(cat.emoji);
  const [order, setOrder] = useState(cat.order);
  const [isActive, setIsActive] = useState(cat.isActive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localDeleted, setLocalDeleted] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/ad-categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, label, emoji, order, isActive }),
    });
    setSaving(false);
    if (res.ok) { setMsg("Saved ✓"); router.refresh(); }
    else { const j = await res.json(); setMsg(j.error ?? "Error"); }
  }

  async function deleteCat() {
    setDeleting(true);
    const res = await fetch(`/api/admin/ad-categories/${cat.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    if (res.ok) { setLocalDeleted(true); router.refresh(); }
    else { const j = await res.json(); setMsg(j.error ?? "Error"); }
  }

  if (localDeleted) return null;

  return (
    <>
      <tr className={`transition-colors cursor-pointer ${open ? "bg-surface-raised" : "hover:bg-surface-raised/40"}`}
        onClick={() => { setOpen((v) => !v); setMsg(null); }}>
        <td className="px-3 py-2 text-lg">{cat.emoji}</td>
        <td className="px-3 py-2 text-xs text-foreground-muted font-mono">{cat.slug}</td>
        <td className="px-3 py-2 text-sm text-foreground">{cat.label}</td>
        <td className="px-3 py-2 text-xs text-foreground-muted">{cat.order}</td>
        <td className="px-3 py-2">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${isActive ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-surface-overlay text-foreground-muted border-border"}`}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-brand">{open ? "▲ Close" : "▼ Edit"}</td>
      </tr>

      {open && (
        <tr className="bg-surface-raised border-t border-border">
          <td colSpan={6} className="px-6 py-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1 w-20">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Emoji</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2 text-center" value={emoji}
                  onChange={(e) => setEmoji(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="flex flex-col gap-1 w-36">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Slug</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2 font-mono" value={slug}
                  onChange={(e) => setSlug(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="flex flex-col gap-1 w-44">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Label</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={label}
                  onChange={(e) => setLabel(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="flex flex-col gap-1 w-20">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Order</label>
                <input type="number" className="text-sm rounded border border-border bg-background text-foreground p-2" value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="flex flex-col gap-1 w-24">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Active</label>
                <select className="text-sm rounded border border-border bg-background text-foreground p-2" value={isActive ? "yes" : "no"}
                  onChange={(e) => setIsActive(e.target.value === "yes")} onClick={(e) => e.stopPropagation()}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={(e) => { e.stopPropagation(); save(); }} disabled={saving}
                  className="px-4 py-1.5 text-sm rounded bg-brand text-white disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                {!confirmDelete ? (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                    className="px-4 py-1.5 text-sm rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20">
                    Delete
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteCat(); }} disabled={deleting}
                      className="px-3 py-1.5 text-xs rounded bg-danger text-white disabled:opacity-50">
                      {deleting ? "..." : "Confirm"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                      className="px-3 py-1.5 text-xs rounded border border-border text-foreground-muted">
                      Cancel
                    </button>
                  </div>
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
