"use client";

import { useState, useMemo } from "react";
import { Download, ChevronDown, Trash2 } from "lucide-react";

type Status = "unread" | "pending" | "addressed";

interface Attachment {
  filename: string;
  content: string; // base64
  mimeType?: string;
}

interface ContactMessage {
  id: string;
  category: string;
  email: string;
  subject: string;
  message: string;
  attachments: unknown;
  status: string;
  createdAt: Date;
}

const STATUS_STYLES: Record<Status, string> = {
  unread: "bg-danger/15 text-danger border-danger/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  addressed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const STATUS_CYCLE: Record<Status, Status> = {
  unread: "pending",
  pending: "addressed",
  addressed: "unread",
};

const STATUS_NEXT_LABEL: Record<Status, string> = {
  unread: "Mark Pending",
  pending: "Mark Addressed",
  addressed: "Mark Unread",
};

function downloadAttachment(a: Attachment) {
  const bytes = Uint8Array.from(atob(a.content), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: a.mimeType ?? "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = a.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  return raw as Attachment[];
}

const CONTACT_CATEGORIES = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Account Issue",
  "Billing",
  "Content / Moderation",
  "Other",
];

export function ContactMessagesTable({ initialMessages }: { initialMessages: ContactMessage[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Column filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filterCategory && m.category !== filterCategory) return false;
      if (filterEmail && !m.email.toLowerCase().includes(filterEmail.toLowerCase())) return false;
      if (filterSubject && !m.subject.toLowerCase().includes(filterSubject.toLowerCase())) return false;
      if (filterStatus && m.status !== filterStatus) return false;
      if (filterDateFrom && new Date(m.createdAt) < new Date(filterDateFrom)) return false;
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(m.createdAt) > to) return false;
      }
      return true;
    });
  }, [messages, filterCategory, filterEmail, filterSubject, filterStatus, filterDateFrom, filterDateTo]);

  async function cycleStatus(id: string, current: Status) {
    const next = STATUS_CYCLE[current];
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: next } : m)),
        );
      }
    } finally {
      setUpdating(null);
    }
  }

  async function deleteMessage(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/contact/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        if (expanded === id) setExpanded(null);
      }
    } finally {
      setDeleting(null);
    }
  }

  const inputCls = "w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground placeholder:text-foreground-subtle";
  const selectCls = "w-full h-7 px-1 text-xs rounded border border-border bg-background text-foreground";

  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <p className="text-foreground-muted text-sm">No contact messages yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          {/* Column labels */}
          <tr className="border-b border-border bg-surface-raised">
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-36">Date</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-36">Category</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-44">Email</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide">Subject</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-28">Files</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-28">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-48"></th>
          </tr>
          {/* Filter row */}
          <tr className="border-b border-border bg-surface">
            <th className="px-2 py-2 font-normal">
              <div className="flex flex-col gap-1">
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className={inputCls} title="From" />
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className={inputCls} title="To" />
              </div>
            </th>
            <th className="px-2 py-2 font-normal">
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={selectCls}>
                <option value="">All categories</option>
                {CONTACT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </th>
            <th className="px-2 py-2 font-normal">
              <input value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)} placeholder="Filter email…" className={inputCls} />
            </th>
            <th className="px-2 py-2 font-normal">
              <input value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} placeholder="Filter subject…" className={inputCls} />
            </th>
            <th className="px-2 py-2 font-normal" />
            <th className="px-2 py-2 font-normal">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
                <option value="">All</option>
                <option value="unread">Unread</option>
                <option value="pending">Pending</option>
                <option value="addressed">Addressed</option>
              </select>
            </th>
            <th className="px-2 py-2 font-normal">
              <button
                onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterCategory(""); setFilterEmail(""); setFilterSubject(""); setFilterStatus(""); }}
                className="h-7 px-3 text-xs rounded border border-border text-foreground-muted hover:text-foreground"
              >
                Clear
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filteredMessages.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-foreground-muted text-sm">No messages match the current filters.</td>
            </tr>
          )}
          {filteredMessages.map((msg) => {
            const attachments = parseAttachments(msg.attachments);
            const status = msg.status as Status;
            const isExpanded = expanded === msg.id;

            return (
              <>
                <tr
                  key={msg.id}
                  className={`hover:bg-surface-raised transition-colors ${msg.status === "unread" ? "font-medium" : ""}`}
                >
                  <td className="px-4 py-3 text-xs text-foreground-muted whitespace-nowrap">
                    {new Date(msg.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    <div className="text-[10px] text-foreground-subtle">
                      {new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">{msg.category}</td>
                  <td className="px-4 py-3 text-xs text-foreground">
                    <a href={`mailto:${msg.email}`} className="hover:text-brand transition-colors">
                      {msg.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground max-w-xs">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : msg.id)}
                      className="flex items-center gap-1 text-left hover:text-brand transition-colors"
                    >
                      <span className="truncate max-w-[200px]">{msg.subject || "(no subject)"}</span>
                      <ChevronDown
                        size={12}
                        className={`shrink-0 text-foreground-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {attachments.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {attachments.map((a, i) => (
                          <button
                            key={i}
                            onClick={() => downloadAttachment(a)}
                            title={a.filename}
                            className="flex items-center gap-1 text-[10px] text-brand hover:text-brand/80 transition-colors"
                          >
                            <Download size={10} />
                            <span className="truncate max-w-[80px]">{a.filename}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-foreground-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${STATUS_STYLES[status]}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cycleStatus(msg.id, status)}
                        disabled={updating === msg.id || deleting === msg.id}
                        className="text-xs px-2.5 py-1 rounded-md border border-border text-foreground-muted hover:text-foreground hover:border-brand/50 transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        {updating === msg.id ? "…" : STATUS_NEXT_LABEL[status]}
                      </button>
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        disabled={deleting === msg.id || updating === msg.id}
                        title="Delete message"
                        className="p-1 rounded text-foreground-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                      >
                        {deleting === msg.id ? <span className="text-xs">…</span> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${msg.id}-expanded`} className="bg-surface-raised">
                    <td colSpan={7} className="px-6 py-4">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
