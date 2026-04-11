"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  isExhibition: boolean;
  isDeleted: boolean;
  suspendedUntil: Date | null;
  elo: number;
  wins: number;
  losses: number;
  createdAt: Date;
}

function getStatus(u: User): { label: string; style: string } {
  if (u.isDeleted) return { label: "Deleted", style: "bg-danger/10 text-danger border-danger/20" };
  if (u.role === "banned") return { label: "Banned", style: "bg-danger/10 text-danger border-danger/20" };
  if (u.role === "suspended" && u.suspendedUntil && u.suspendedUntil > new Date())
    return { label: `Suspended until ${new Date(u.suspendedUntil).toLocaleDateString()}`, style: "bg-accent/10 text-accent border-accent/20" };
  if (u.role === "admin") return { label: "Admin", style: "bg-brand/10 text-brand border-brand/20" };
  if (u.isExhibition) return { label: "Exhibition", style: "bg-surface-overlay text-foreground-muted border-border" };
  return { label: "Active", style: "bg-green-500/10 text-green-400 border-green-500/20" };
}

const SUSPEND_OPTIONS = [
  { label: "5min (test)", value: 5 / 1440 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export function UserRow({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [suspendDays, setSuspendDays] = useState(7);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isBanned = user.role === "banned";
  const isSuspended = user.role === "suspended" && !!user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
  const status = getStatus(user);

  async function apply(action: string) {
    setLoading(true);
    setMsg(null);
    await fetch(`/api/admin/users/${user.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, suspendDays }),
    });
    setLoading(false);
    setMsg(action === "warn" ? "Warning sent ✓" : "Done ✓");
    router.refresh();
  }

  async function deleteUser() {
    setLoading(true);
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setLoading(false);
    setConfirmDelete(false);
    setMsg("Deleted ✓");
    router.refresh();
  }

  return (
    <>
      <tr
        className={`transition-colors cursor-pointer ${open ? "bg-surface-raised" : "hover:bg-surface-raised/40"}`}
        onClick={() => { setOpen((v) => !v); setMsg(null); }}
      >
        <td className="px-4 py-3 font-medium text-foreground">
          <Link
            href={`/profile/${user.username}`}
            target="_blank"
            className="hover:text-brand"
            onClick={(e) => e.stopPropagation()}
          >
            {user.username}
          </Link>
          {user.isExhibition && (
            <span className="ml-1.5 text-[10px] text-foreground-muted">[exhibition]</span>
          )}
        </td>
        <td className="px-4 py-3 text-foreground-muted text-xs">{user.email}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${status.style}`}>
            {status.label}
          </span>
        </td>
        <td className="px-4 py-3 text-foreground-muted text-sm">{user.elo}</td>
        <td className="px-4 py-3 text-foreground-muted text-sm whitespace-nowrap">{user.wins}W / {user.losses}L</td>
        <td className="px-4 py-3 text-foreground-muted text-xs whitespace-nowrap">
          {new Date(user.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-xs text-brand whitespace-nowrap">
          {open ? "▲ Close" : "▼ Actions"}
        </td>
      </tr>

      {open && (
        <tr className="bg-surface-raised border-t border-border">
          <td colSpan={7} className="px-6 py-4">
            {user.isDeleted ? (
              <p className="text-sm text-foreground-muted italic">Account deleted — no actions available.</p>
            ) : (
              <div className="flex flex-wrap gap-6 items-start">
                <div className="flex flex-col gap-1 w-56">
                  <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
                    Reason (optional)
                  </label>
                  <input
                    className="text-sm rounded border border-border bg-background text-foreground p-2"
                    placeholder="Reason…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="flex flex-col gap-2 pt-5">
                  <button
                    onClick={(e) => { e.stopPropagation(); apply("warn"); }}
                    disabled={loading}
                    className="px-4 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50"
                  >
                    Issue Warning
                  </button>

                  {!isSuspended && !isBanned && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); apply("suspend"); }}
                        disabled={loading}
                        className="px-4 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50"
                      >
                        Suspend
                      </button>
                      <select
                        value={suspendDays}
                        onChange={(e) => setSuspendDays(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm rounded border border-border bg-background text-foreground p-1.5"
                      >
                        {SUSPEND_OPTIONS.map((o) => (
                          <option key={o.label} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(isSuspended || isBanned) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); apply("unban"); }}
                      disabled={loading}
                      className="px-4 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50"
                    >
                      {isBanned ? "Unban" : "Lift Suspension"}
                    </button>
                  )}

                  {!isBanned && (
                    <button
                      onClick={(e) => { e.stopPropagation(); apply("ban"); }}
                      disabled={loading}
                      className="px-4 py-1.5 text-sm rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 disabled:opacity-50"
                    >
                      Permanent Ban
                    </button>
                  )}

                  {!confirmDelete ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                      className="px-4 py-1.5 text-sm rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteUser(); }}
                        disabled={loading}
                        className="px-4 py-1.5 text-sm rounded bg-danger text-white disabled:opacity-50"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                        className="px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {msg && <p className="text-sm text-foreground-muted pt-5">{msg}</p>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
