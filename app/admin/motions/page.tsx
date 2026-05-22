"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Download, Upload, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";

interface Category {
  id: string;
  slug: string;
  label: string;
  emoji: string;
}

interface Motion {
  id: string;
  text: string;
  notes: string | null;
  createdAt: string;
  category: Category | null;
}

const EMPTY_FORM = { text: "", categoryId: "", notes: "" };

export default function AdminMotionsPage() {
  const [motions, setMotions] = useState<Motion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("");
  const [filterText, setFilterText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, cRes] = await Promise.all([
      fetch("/api/admin/motions"),
      fetch("/api/categories"),
    ]);
    if (mRes.ok) setMotions((await mRes.json()).motions ?? []);
    if (cRes.ok) setCategories(await cRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered view ──────────────────────────────────────────────────────────
  const visible = motions.filter((m) => {
    if (filterCat && m.category?.id !== filterCat) return false;
    if (filterText && !m.text.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  // ── Add ───────────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!addForm.text.trim()) { setAddError("Motion text is required."); return; }
    setAddSaving(true);
    const res = await fetch("/api/admin/motions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: addForm.text, categoryId: addForm.categoryId || null, notes: addForm.notes }),
    });
    setAddSaving(false);
    if (res.ok) { setAddForm(EMPTY_FORM); await load(); }
    else { const d = await res.json(); setAddError(d.error ?? "Failed to add."); }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEdit(m: Motion) {
    setEditingId(m.id);
    setEditForm({ text: m.text, categoryId: m.category?.id ?? "", notes: m.notes ?? "" });
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    await fetch(`/api/admin/motions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editForm.text, categoryId: editForm.categoryId || null, notes: editForm.notes }),
    });
    setEditSaving(false);
    setEditingId(null);
    await load();
  }

  // ── Delete single ─────────────────────────────────────────────────────────
  async function deleteOne(id: string) {
    if (!confirm("Delete this motion?")) return;
    await fetch(`/api/admin/motions/${id}`, { method: "DELETE" });
    setMotions((prev) => prev.filter((m) => m.id !== id));
  }

  // ── Delete selected ───────────────────────────────────────────────────────
  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} motion(s)?`)) return;
    await fetch("/api/admin/motions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    setSelected(new Set());
    await load();
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((m) => m.id)));
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    window.open("/api/admin/motions/export", "_blank");
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setImportResult(null);

    const text = await file.text();
    let rows: { text: string; category?: string; notes?: string }[] = [];

    // Try JSON first, then CSV
    if (file.name.endsWith(".json")) {
      try { rows = JSON.parse(text); } catch { setImportResult("Invalid JSON file."); setImporting(false); return; }
    } else {
      // CSV: first row is headers
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
      const textIdx = headers.indexOf("text");
      const catIdx = headers.indexOf("category");
      const notesIdx = headers.indexOf("notes");
      if (textIdx < 0) { setImportResult("CSV must have a 'text' column."); setImporting(false); return; }

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g)?.map((c) =>
          c.startsWith('"') ? c.slice(1, -1).replace(/""/g, '"') : c
        ) ?? [];
        const t = cols[textIdx]?.trim();
        if (!t) continue;
        rows.push({
          text: t,
          category: catIdx >= 0 ? cols[catIdx]?.trim() : undefined,
          notes: notesIdx >= 0 ? cols[notesIdx]?.trim() : undefined,
        });
      }
    }

    const res = await fetch("/api/admin/motions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const d = await res.json();
    setImporting(false);
    if (res.ok) {
      setImportResult(`Imported ${d.created} motion(s). Skipped ${d.skipped}.`);
      await load();
    } else {
      setImportResult(d.error ?? "Import failed.");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">
          Motion Library
          <span className="ml-2 text-base font-normal text-foreground-muted">({motions.length})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={14} /> Download CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const data = motions.map((m) => ({
                text: m.text,
                category: m.category?.slug ?? "",
                notes: m.notes ?? "",
              }));
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `motions-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={14} /> Download JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Bulk Upload
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {importResult && (
        <div className="mb-4 px-4 py-3 rounded-[--radius] bg-brand/5 border border-brand/20 text-sm text-foreground-muted">
          {importResult}
        </div>
      )}

      {/* ── Add form ── */}
      <section className="mb-6 p-4 rounded-[--radius-lg] bg-surface border border-border">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Plus size={14} /> Add Motion</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <textarea
            rows={2}
            className="w-full rounded-[--radius] border border-border bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted resize-none focus:outline-none focus:ring-2 focus:ring-brand/50"
            placeholder="Type the debate motion…"
            value={addForm.text}
            onChange={(e) => setAddForm((f) => ({ ...f, text: e.target.value }))}
          />
          <div className="flex gap-2 flex-wrap">
            <select
              className="rounded-[--radius] border border-border bg-surface-raised px-2 py-1.5 text-sm text-foreground flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-brand/50"
              value={addForm.categoryId}
              onChange={(e) => setAddForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <input
              className="flex-1 min-w-[180px] rounded-[--radius] border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
              placeholder="Notes (optional)"
              value={addForm.notes}
              onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <Button type="submit" size="sm" disabled={addSaving}>
              {addSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add
            </Button>
          </div>
          {addError && <p className="text-xs text-danger">{addError}</p>}
        </form>
      </section>

      {/* ── Filters + bulk actions ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          className="rounded-[--radius] border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50 flex-1 min-w-[160px]"
          placeholder="Search motions…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <select
          className="rounded-[--radius] border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
        {selected.size > 0 && (
          <Button variant="outline" size="sm" onClick={deleteSelected} className="text-danger border-danger/30 hover:bg-danger/5">
            <Trash2 size={13} /> Delete {selected.size} selected
          </Button>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-foreground-muted"><Loader2 size={20} className="animate-spin" /></div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-foreground-muted p-6 text-center border border-border rounded-[--radius-lg] bg-surface">
          {motions.length === 0 ? "No motions yet. Add one above or bulk upload a CSV." : "No matches for the current filter."}
        </p>
      ) : (
        <div className="rounded-[--radius-lg] border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised border-b border-border">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" checked={selected.size === visible.length && visible.length > 0}
                    onChange={toggleAll} className="accent-[var(--brand)]" />
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground-muted">Motion</th>
                <th className="px-3 py-2 text-left font-medium text-foreground-muted w-36">Category</th>
                <th className="px-3 py-2 text-left font-medium text-foreground-muted w-32 hidden sm:table-cell">Notes</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {visible.map((m) => (
                <tr key={m.id} className="hover:bg-surface-raised/40 transition-colors">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="accent-[var(--brand)]" />
                  </td>
                  <td className="px-3 py-2.5">
                    {editingId === m.id ? (
                      <textarea
                        rows={2}
                        className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-brand/50"
                        value={editForm.text}
                        onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
                      />
                    ) : (
                      <span className="text-foreground leading-snug">{m.text}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {editingId === m.id ? (
                      <select
                        className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground focus:outline-none"
                        value={editForm.categoryId}
                        onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
                      >
                        <option value="">No category</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs text-foreground-muted">
                        {m.category ? `${m.category.emoji} ${m.category.label}` : <span className="opacity-40">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {editingId === m.id ? (
                      <input
                        className="w-full rounded border border-border bg-surface-raised px-2 py-1 text-xs text-foreground focus:outline-none"
                        value={editForm.notes}
                        onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    ) : (
                      <span className="text-xs text-foreground-muted line-clamp-1">{m.notes ?? <span className="opacity-40">—</span>}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {editingId === m.id ? (
                        <>
                          <button onClick={() => saveEdit(m.id)} disabled={editSaving}
                            className="p-1.5 rounded text-success hover:bg-success/10 transition-colors disabled:opacity-50">
                            {editSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors">
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(m)}
                            className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteOne(m.id)}
                            className="p-1.5 rounded text-foreground-muted hover:text-danger hover:bg-danger/5 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CSV format hint */}
      <p className="mt-4 text-xs text-foreground-subtle">
        Bulk upload accepts <strong>.csv</strong> (columns: <code>text</code>, <code>category</code>, <code>notes</code>) or <strong>.json</strong> (array of <code>{"{ text, category, notes }"}</code>).
        Category is matched by slug or label — unrecognised values are left blank.
      </p>
    </div>
  );
}
