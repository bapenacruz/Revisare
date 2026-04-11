"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Download, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Category {
  id: string;
  label: string;
  emoji: string;
  description: string;
  order: number;
  isActive: boolean;
  slug: string;
}

const inputCls =
  "bg-surface border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-brand w-full";

export function CategoriesClient({ initial }: { initial: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Pick<Category, "label" | "emoji" | "description">>({
    label: "",
    emoji: "",
    description: "",
  });
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState({ emoji: "", label: "", description: "" });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(categories, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "categories.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditDraft({ label: cat.label, emoji: cat.emoji, description: cat.description });
    setDeleteConfirmId(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Failed to update");
        return;
      }
      const { category } = await res.json();
      setCategories((cats) => cats.map((c) => (c.id === id ? { ...c, ...category } : c)));
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(cat: Category) {
    const next = !cat.isActive;
    setCategories((cats) => cats.map((c) => (c.id === cat.id ? { ...c, isActive: next } : c)));
    await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, isActive: next }),
    });
  }

  async function saveAdd() {
    if (!newCat.label.trim() || !newCat.emoji.trim()) {
      setError("Label and emoji are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCat),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Failed to create");
        return;
      }
      const { category } = await res.json();
      setCategories((cats) => [...cats, category]);
      setAdding(false);
      setNewCat({ emoji: "", label: "", description: "" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Failed to delete");
        return;
      }
      setCategories((cats) => cats.filter((c) => c.id !== id));
      setDeleteConfirmId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Categories</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={downloadJSON}>
            <Download size={14} />
            Download JSON
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
              setDeleteConfirmId(null);
              setError(null);
            }}
          >
            <Plus size={14} />
            Add Category
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-sm text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="rounded-[--radius] border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              {["Category", "Slug", "Description", "Active", ""].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-foreground-muted uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((cat) => (
              <tr key={cat.id} className="bg-background hover:bg-surface transition-colors">
                {editingId === cat.id ? (
                  <>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={editDraft.emoji}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, emoji: e.target.value }))
                          }
                          className={`${inputCls} w-14 text-center`}
                          placeholder="emoji"
                        />
                        <input
                          value={editDraft.label}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, label: e.target.value }))
                          }
                          className={inputCls}
                          placeholder="Label"
                          autoFocus
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-foreground-muted text-xs">{cat.slug}</td>
                    <td className="px-4 py-2">
                      <input
                        value={editDraft.description}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, description: e.target.value }))
                        }
                        className={inputCls}
                        placeholder="Description"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => toggleActive(cat)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          cat.isActive ? "bg-brand" : "bg-border"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            cat.isActive ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEdit(cat.id)}
                          disabled={busy}
                          title="Save"
                          className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                        </button>
                        <button
                          onClick={cancelEdit}
                          title="Cancel"
                          className="p-1.5 rounded text-foreground-muted hover:bg-surface-raised"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : deleteConfirmId === cat.id ? (
                  <>
                    <td colSpan={4} className="px-4 py-3">
                      <span className="text-sm text-danger font-medium">
                        Delete &quot;{cat.label}&quot;? All its debates and challenges will move
                        to Other.
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          disabled={busy}
                          title="Confirm delete"
                          className="p-1.5 rounded text-danger hover:bg-danger/10 disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          title="Cancel"
                          className="p-1.5 rounded text-foreground-muted hover:bg-surface-raised"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <span className="text-xl mr-2">{cat.emoji}</span>
                      <span className="font-medium text-foreground">{cat.label}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted text-xs">{cat.slug}</td>
                    <td className="px-4 py-3 text-foreground-muted text-sm max-w-xs truncate">
                      {cat.description}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(cat)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          cat.isActive ? "bg-brand" : "bg-border"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            cat.isActive ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(cat)}
                          title="Edit"
                          className="p-1.5 rounded text-foreground-muted hover:text-brand hover:bg-brand/10 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        {cat.slug !== "other" && (
                          <button
                            onClick={() => {
                              setDeleteConfirmId(cat.id);
                              setEditingId(null);
                              setError(null);
                            }}
                            title="Delete"
                            className="p-1.5 rounded text-foreground-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {/* Add new category row */}
            {adding && (
              <tr className="bg-brand/5 border-t-2 border-brand/30">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={newCat.emoji}
                      onChange={(e) => setNewCat((n) => ({ ...n, emoji: e.target.value }))}
                      className={`${inputCls} w-14 text-center`}
                      placeholder="emoji"
                    />
                    <input
                      value={newCat.label}
                      onChange={(e) => setNewCat((n) => ({ ...n, label: e.target.value }))}
                      className={inputCls}
                      placeholder="Label *"
                      autoFocus
                    />
                  </div>
                </td>
                <td className="px-4 py-2 text-xs text-foreground-subtle italic">auto</td>
                <td className="px-4 py-2">
                  <input
                    value={newCat.description}
                    onChange={(e) => setNewCat((n) => ({ ...n, description: e.target.value }))}
                    className={inputCls}
                    placeholder="Description"
                  />
                </td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={saveAdd}
                      disabled={busy}
                      title="Create"
                      className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40"
                    >
                      {busy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setAdding(false);
                        setNewCat({ emoji: "", label: "", description: "" });
                        setError(null);
                      }}
                      title="Cancel"
                      className="p-1.5 rounded text-foreground-muted hover:bg-surface-raised"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
