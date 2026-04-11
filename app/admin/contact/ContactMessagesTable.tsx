"use client";

import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";

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

export function ContactMessagesTable({ initialMessages }: { initialMessages: ContactMessage[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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
          <tr className="border-b border-border bg-surface-raised">
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-36">Date</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-36">Category</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-44">Email</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide">Subject</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-28">Files</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-28">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-foreground-muted uppercase tracking-wide w-36"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {messages.map((msg) => {
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
                    <button
                      onClick={() => cycleStatus(msg.id, status)}
                      disabled={updating === msg.id}
                      className="text-xs px-2.5 py-1 rounded-md border border-border text-foreground-muted hover:text-foreground hover:border-brand/50 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      {updating === msg.id ? "…" : STATUS_NEXT_LABEL[status]}
                    </button>
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
