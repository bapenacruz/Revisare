"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AdCategory {
  id: string;
  label: string;
  emoji: string;
}

interface Ad {
  id: string;
  motion: string;
  proponentName: string;
  opponentName: string;
  categoryId: string | null;
  linkUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  category: { label: string; emoji: string } | null;
}

export function AdRow({ ad, categories }: { ad: Ad; categories: AdCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motion, setMotion] = useState(ad.motion);
  const [proponentName, setProponentName] = useState(ad.proponentName);
  const [opponentName, setOpponentName] = useState(ad.opponentName);
  const [categoryId, setCategoryId] = useState(ad.categoryId ?? "");
  const [linkUrl, setLinkUrl] = useState(ad.linkUrl ?? "");
  const [isActive, setIsActive] = useState(ad.isActive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localDeleted, setLocalDeleted] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/ads/${ad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motion, proponentName, opponentName, categoryId: categoryId || null, linkUrl: linkUrl || null, isActive }),
    });
    setSaving(false);
    if (res.ok) { setMsg("Saved ✓"); router.refresh(); }
    else { const j = await res.json(); setMsg(j.error ?? "Error"); }
  }

  async function deleteAd() {
    setDeleting(true);
    const res = await fetch(`/api/admin/ads/${ad.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    if (res.ok) { setLocalDeleted(true); setMsg("Deleted ✓"); }
    else { const j = await res.json(); setMsg(j.error ?? "Error"); }
  }

  if (localDeleted) return null;

  return (
    <>
      <tr
        className={`transition-colors cursor-pointer ${open ? "bg-surface-raised" : "hover:bg-surface-raised/40"}`}
        onClick={() => { setOpen((v) => !v); setMsg(null); }}
      >
        <td className="px-2 py-2 max-w-[200px] text-xs text-foreground line-clamp-2">{ad.motion}</td>
        <td className="px-2 py-2 text-xs text-foreground">{ad.proponentName}</td>
        <td className="px-2 py-2 text-xs text-foreground-muted">{ad.opponentName}</td>
        <td className="px-2 py-2 text-xs text-foreground-muted">
          {ad.category ? `${ad.category.emoji} ${ad.category.label}` : <span className="opacity-40">—</span>}
        </td>
        <td className="px-2 py-2 text-xs">
          {ad.linkUrl
            ? <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="text-brand truncate max-w-[100px] block" onClick={(e) => e.stopPropagation()}>{ad.linkUrl}</a>
            : <span className="opacity-40">—</span>}
        </td>
        <td className="px-2 py-2">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${isActive ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-surface-overlay text-foreground-muted border-border"}`}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-2 py-2 text-xs text-foreground-muted whitespace-nowrap">
          {new Date(ad.createdAt).toLocaleDateString()}
        </td>
        <td className="px-2 py-2 text-xs text-brand whitespace-nowrap">{open ? "▲ Close" : "▼ Edit"}</td>
      </tr>

      {open && (
        <tr className="bg-surface-raised border-t border-border">
          <td colSpan={8} className="px-6 py-4">
            <div className="flex flex-wrap gap-4 items-start">
              <div className="flex flex-col gap-1 flex-1 min-w-48">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Motion</label>
                <textarea className="text-sm rounded border border-border bg-background text-foreground p-2 resize-none w-full" rows={3}
                  value={motion} onChange={(e) => setMotion(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="flex flex-col gap-1 w-40">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Proponent</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={proponentName}
                  onChange={(e) => setProponentName(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="flex flex-col gap-1 w-40">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Opponent</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={opponentName}
                  onChange={(e) => setOpponentName(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="flex flex-col gap-1 w-44">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Ad Category</label>
                <select className="text-sm rounded border border-border bg-background text-foreground p-2" value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)} onClick={(e) => e.stopPropagation()}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 w-56">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Link URL</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={linkUrl} placeholder="https://…"
                  onChange={(e) => setLinkUrl(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="flex flex-col gap-1 w-24">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Active</label>
                <select className="text-sm rounded border border-border bg-background text-foreground p-2" value={isActive ? "yes" : "no"}
                  onChange={(e) => setIsActive(e.target.value === "yes")} onClick={(e) => e.stopPropagation()}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 justify-end pt-5">
                <button onClick={(e) => { e.stopPropagation(); save(); }} disabled={saving}
                  className="px-4 py-1.5 text-sm rounded bg-brand text-white disabled:opacity-50 whitespace-nowrap">
                  {saving ? "Saving..." : "Save"}
                </button>
                {!confirmDelete ? (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                    className="px-4 py-1.5 text-sm rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20">
                    Delete
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteAd(); }} disabled={deleting}
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
