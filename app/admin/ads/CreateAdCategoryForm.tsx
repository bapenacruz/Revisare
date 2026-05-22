"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateAdCategoryForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("");
  const [order, setOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function create() {
    if (!slug.trim() || !label.trim()) { setMsg("Slug and label are required."); return; }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/ad-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, label, emoji: emoji || "📢", order }),
    });
    setSaving(false);
    if (res.ok) {
      setSlug(""); setLabel(""); setEmoji(""); setOrder(0);
      setMsg("Category created ✓");
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
        <span>+ Create Ad Category</span>
        <span className="text-foreground-muted text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-4 bg-surface border-t border-border flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1 w-20">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Emoji</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2 text-center" value={emoji}
              onChange={(e) => setEmoji(e.target.value)} placeholder="📢" />
          </div>
          <div className="flex flex-col gap-1 w-36">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Slug *</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2 font-mono" value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="my-category" />
          </div>
          <div className="flex flex-col gap-1 w-48">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Label *</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={label}
              onChange={(e) => setLabel(e.target.value)} placeholder="My Category" />
          </div>
          <div className="flex flex-col gap-1 w-20">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Order</label>
            <input type="number" className="text-sm rounded border border-border bg-background text-foreground p-2" value={order}
              onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={create} disabled={saving}
              className="px-4 py-1.5 text-sm rounded bg-brand text-white disabled:opacity-50">
              {saving ? "Creating..." : "Create"}
            </button>
            {msg && <p className="text-xs text-foreground-muted">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
