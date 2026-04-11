"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  label: string;
  emoji: string;
}

interface Debate {
  id: string;
  motion: string;
  categoryId: string;
  status: string;
}

export function DebateActions({
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
  const [msg, setMsg] = useState<string | null>(null);

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
      setMsg("Saved");
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
      setMsg("Rejudge started — results in ~60s");
      router.refresh();
    } else {
      const j = await res.json();
      setMsg(j.error ?? "Rejudge failed");
    }
  }

  return (
    <div>
      <button
        onClick={() => { setOpen((v) => !v); setMsg(null); }}
        className="text-xs text-brand hover:underline"
      >
        Actions
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-[--radius] border border-border bg-surface-raised w-72 flex flex-col gap-2">
          <label className="text-xs text-foreground-muted font-medium">Motion</label>
          <textarea
            className="w-full text-xs rounded border border-border bg-background text-foreground p-1.5 resize-none"
            rows={3}
            value={motion}
            onChange={(e) => setMotion(e.target.value)}
          />

          <label className="text-xs text-foreground-muted font-medium">Category</label>
          <select
            className="w-full text-xs rounded border border-border bg-background text-foreground p-1.5"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>

          <button
            onClick={save}
            disabled={saving}
            className="px-2 py-1 text-xs rounded bg-brand text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {debate.status === "completed" && (
            <>
              <button
                onClick={rejudge}
                disabled={rejudging}
                className="px-2 py-1 text-xs rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50"
              >
                {rejudging ? "Rejudging..." : "Re-run AI Judgement"}
              </button>
            </>
          )}

          {msg && <p className="text-xs text-foreground-muted">{msg}</p>}
        </div>
      )}
    </div>
  );
}
