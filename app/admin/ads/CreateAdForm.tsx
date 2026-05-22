"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AdCategory {
  id: string;
  label: string;
  emoji: string;
}

export function CreateAdForm({ categories }: { categories: AdCategory[] }) {
  const router = useRouter();
  const [motion, setMotion] = useState("");
  const [proponentName, setProponentName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function create() {
    if (!motion.trim() || !proponentName.trim() || !opponentName.trim()) {
      setMsg("Motion, proponent and opponent are required.");
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motion, proponentName, opponentName, categoryId: categoryId || null, linkUrl: linkUrl || null }),
    });
    setSaving(false);
    if (res.ok) {
      setMotion(""); setProponentName(""); setOpponentName(""); setCategoryId(""); setLinkUrl("");
      setMsg("Ad created ✓");
      router.refresh();
      setOpen(false);
    } else {
      const j = await res.json();
      setMsg(j.error ?? "Error");
    }
  }

  return (
    <div className="mb-4 border border-border rounded-[--radius] overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-2.5 bg-surface text-sm font-medium text-foreground hover:bg-surface-raised transition-colors"
        onClick={() => setOpen((v) => !v)}>
        <span>+ Create New Ad</span>
        <span className="text-foreground-muted text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-4 bg-surface border-t border-border flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-48">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Motion *</label>
            <textarea className="text-sm rounded border border-border bg-background text-foreground p-2 resize-none" rows={3}
              value={motion} onChange={(e) => setMotion(e.target.value)} placeholder="This House Believes…" />
          </div>
          <div className="flex flex-col gap-1 w-40">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Proponent *</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={proponentName}
              onChange={(e) => setProponentName(e.target.value)} placeholder="Display name" />
          </div>
          <div className="flex flex-col gap-1 w-40">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Opponent *</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)} placeholder="Display name" />
          </div>
          <div className="flex flex-col gap-1 w-44">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Ad Category</label>
            <select className="text-sm rounded border border-border bg-background text-foreground p-2" value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-56">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Link URL</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={create} disabled={saving}
              className="px-4 py-1.5 text-sm rounded bg-brand text-white disabled:opacity-50 whitespace-nowrap">
              {saving ? "Creating..." : "Create Ad"}
            </button>
            {msg && <p className="text-xs text-foreground-muted">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
