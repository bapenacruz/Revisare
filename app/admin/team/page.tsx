"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ImageCropModal } from "@/components/features/admin/ImageCropModal";
import { Pencil, Trash2, GripVertical, Plus, ImagePlus, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  description: string | null;
  imageDataUrl: string | null;
  order: number;
  isActive: boolean;
}

const EMPTY_FORM = { name: "", role: "", description: "", imageDataUrl: null as string | null, isActive: true };
type MemberForm = typeof EMPTY_FORM;

export default function AdminTeamPage() {
  // ── Intro text ──────────────────────────────────────────────────────────────
  const [introText, setIntroText] = useState("");
  const [introSaving, setIntroSaving] = useState(false);
  const [introSaved, setIntroSaved] = useState(false);

  // ── Members ─────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Add form ─────────────────────────────────────────────────────────────────
  const [addForm, setAddForm] = useState<MemberForm>(EMPTY_FORM);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [showAddCrop, setShowAddCrop] = useState(false);

  // ── Edit form ─────────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MemberForm>(EMPTY_FORM);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [showEditCrop, setShowEditCrop] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const [settRes, memRes] = await Promise.all([
      fetch("/api/admin/team/settings"),
      fetch("/api/admin/team/members"),
    ]);
    if (settRes.ok) {
      const d = await settRes.json();
      setIntroText(d.introText ?? "");
    }
    if (memRes.ok) {
      const d = await memRes.json();
      setMembers(d.members ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save intro text ──────────────────────────────────────────────────────────
  async function saveIntro() {
    setIntroSaving(true);
    const res = await fetch("/api/admin/team/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ introText }),
    });
    setIntroSaving(false);
    if (res.ok) {
      setIntroSaved(true);
      setTimeout(() => setIntroSaved(false), 2000);
    }
  }

  // ── Add member ───────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!addForm.name.trim()) { setAddError("Name is required."); return; }
    if (!addForm.role.trim()) { setAddError("Role is required."); return; }
    setAddSaving(true);
    const res = await fetch("/api/admin/team/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    setAddSaving(false);
    if (res.ok) {
      setAddForm(EMPTY_FORM);
      setAddError("");
      await loadData();
    } else {
      const d = await res.json().catch(() => ({}));
      setAddError(d.error ?? "Failed to add member.");
    }
  }

  // ── Delete member ────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Delete this team member?")) return;
    await fetch(`/api/admin/team/members/${id}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  // ── Start edit ───────────────────────────────────────────────────────────────
  function startEdit(m: TeamMember) {
    setEditingId(m.id);
    setEditForm({
      name: m.name,
      role: m.role,
      description: m.description ?? "",
      imageDataUrl: m.imageDataUrl,
      isActive: m.isActive,
    });
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError("");
  }

  // ── Save edit ────────────────────────────────────────────────────────────────
  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError("");
    if (!editForm.name.trim()) { setEditError("Name is required."); return; }
    if (!editForm.role.trim()) { setEditError("Role is required."); return; }
    setEditSaving(true);
    const res = await fetch(`/api/admin/team/members/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditSaving(false);
    if (res.ok) {
      setEditingId(null);
      await loadData();
    } else {
      const d = await res.json().catch(() => ({}));
      setEditError(d.error ?? "Failed to save.");
    }
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  async function toggleActive(m: TeamMember) {
    await fetch(`/api/admin/team/members/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, isActive: !x.isActive } : x));
  }

  const MemberAvatar = ({ member, size = 40 }: { member: TeamMember | { name: string; imageDataUrl: string | null }; size?: number }) => (
    member.imageDataUrl
      ? <img src={member.imageDataUrl} alt={member.name} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
      : <div style={{ width: size, height: size }} className="rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold shrink-0 text-sm">
          {member.name.charAt(0).toUpperCase() || "?"}
        </div>
  );

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Team Management</h1>

      {/* ── Intro Text ──────────────────────────────────────────────────────── */}
      <section className="mb-8 p-5 rounded-[--radius-lg] bg-surface border border-border">
        <h2 className="text-base font-semibold text-foreground mb-1">Intro Text</h2>
        <p className="text-xs text-foreground-muted mb-3">Shown at the top of the Team tab on the About page.</p>
        <textarea
          rows={3}
          className="w-full rounded-[--radius] border border-border bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted resize-none focus:outline-none focus:ring-2 focus:ring-brand/50 mb-3"
          value={introText}
          onChange={(e) => setIntroText(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={saveIntro} disabled={introSaving}>
            {introSaving ? <Loader2 size={14} className="animate-spin" /> : introSaved ? <Check size={14} /> : null}
            {introSaved ? "Saved!" : "Save intro text"}
          </Button>
        </div>
      </section>

      {/* ── Members List ────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">
          Team Members
          <span className="ml-2 text-xs font-normal text-foreground-muted">({members.length})</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-foreground-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-foreground-muted p-5 rounded-[--radius-lg] bg-surface border border-border">No team members yet. Add one below.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {members.map((m) => (
              <div key={m.id} className={cn("rounded-[--radius-lg] border p-4 bg-surface", editingId === m.id ? "border-brand/40" : "border-border")}>
                {editingId === m.id ? (
                  /* ── Edit inline form ── */
                  <form onSubmit={handleEditSave} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 mb-1">
                      <MemberAvatar member={{ name: editForm.name || m.name, imageDataUrl: editForm.imageDataUrl }} size={40} />
                      <button type="button" onClick={() => setShowEditCrop(true)}
                        className="flex items-center gap-1.5 text-xs text-brand hover:underline">
                        <ImagePlus size={13} /> Change photo
                      </button>
                      {editForm.imageDataUrl && (
                        <button type="button" onClick={() => setEditForm((f) => ({ ...f, imageDataUrl: null }))}
                          className="flex items-center gap-1 text-xs text-foreground-muted hover:text-danger">
                          <X size={12} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-foreground-muted mb-1 block">Name *</label>
                        <input
                          className="w-full rounded-[--radius] border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-foreground-muted mb-1 block">Role *</label>
                        <input
                          className="w-full rounded-[--radius] border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                          value={editForm.role}
                          onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-foreground-muted mb-1 block">Description</label>
                      <textarea
                        rows={3}
                        className="w-full rounded-[--radius] border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-brand/50"
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" className="accent-[var(--brand)]" checked={editForm.isActive}
                          onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} />
                        Active (visible on About page)
                      </label>
                    </div>
                    {editError && <p className="text-xs text-danger">{editError}</p>}
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                      <Button type="submit" size="sm" disabled={editSaving}>
                        {editSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                        Save changes
                      </Button>
                    </div>
                    {showEditCrop && (
                      <ImageCropModal
                        title="Change team member photo"
                        onClose={() => setShowEditCrop(false)}
                        onCropped={(url) => { setEditForm((f) => ({ ...f, imageDataUrl: url })); setShowEditCrop(false); }}
                      />
                    )}
                  </form>
                ) : (
                  /* ── Display row ── */
                  <div className="flex items-start gap-3">
                    <GripVertical size={16} className="mt-1.5 text-foreground-subtle shrink-0 cursor-grab" />
                    <MemberAvatar member={m} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{m.name}</span>
                        <span className="text-xs text-foreground-muted">{m.role}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", m.isActive ? "bg-success/10 text-success" : "bg-surface-raised text-foreground-muted")}>
                          {m.isActive ? "active" : "hidden"}
                        </span>
                      </div>
                      {m.description && <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">{m.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleActive(m)} title={m.isActive ? "Hide" : "Show"}
                        className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors text-xs">
                        {m.isActive ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => startEdit(m)} className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded text-foreground-muted hover:text-danger hover:bg-danger/5 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Add Member Form ──────────────────────────────────────────────────── */}
      <section className="p-5 rounded-[--radius-lg] bg-surface border border-border">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Plus size={16} /> Add Team Member
        </h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          {/* Photo picker */}
          <div className="flex items-center gap-3">
            {addForm.imageDataUrl
              ? <img src={addForm.imageDataUrl} alt="preview" className="w-12 h-12 rounded-full object-cover shrink-0" />
              : <div className="w-12 h-12 rounded-full bg-surface-raised border border-dashed border-border flex items-center justify-center text-foreground-muted shrink-0">
                  <ImagePlus size={18} />
                </div>
            }
            <button type="button" onClick={() => setShowAddCrop(true)}
              className="flex items-center gap-1.5 text-xs text-brand hover:underline">
              <ImagePlus size={13} /> {addForm.imageDataUrl ? "Change photo" : "Add photo (optional)"}
            </button>
            {addForm.imageDataUrl && (
              <button type="button" onClick={() => setAddForm((f) => ({ ...f, imageDataUrl: null }))}
                className="flex items-center gap-1 text-xs text-foreground-muted hover:text-danger">
                <X size={12} /> Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Name *</label>
              <input
                className="w-full rounded-[--radius] border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
                placeholder="Full name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Role *</label>
              <input
                className="w-full rounded-[--radius] border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
                placeholder="e.g. Founder & Developer"
                value={addForm.role}
                onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-foreground-muted mb-1 block">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-[--radius] border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted resize-none focus:outline-none focus:ring-2 focus:ring-brand/50"
              placeholder="Short bio or description (optional)…"
              value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" className="accent-[var(--brand)]" checked={addForm.isActive}
                onChange={(e) => setAddForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Active (visible on About page immediately)
            </label>
          </div>

          {addError && <p className="text-xs text-danger">{addError}</p>}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={addSaving}>
              {addSaving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
              Add member
            </Button>
          </div>
        </form>

        {showAddCrop && (
          <ImageCropModal
            title="Add team member photo"
            onClose={() => setShowAddCrop(false)}
            onCropped={(url) => { setAddForm((f) => ({ ...f, imageDataUrl: url })); setShowAddCrop(false); }}
          />
        )}
      </section>
    </div>
  );
}
