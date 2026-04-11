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
  hideFromLeaderboard: boolean;
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
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState(user.username);
  const [hideFromLeaderboard, setHideFromLeaderboard] = useState(user.hideFromLeaderboard);
  const [localDeleted, setLocalDeleted] = useState(user.isDeleted);

  const isBanned = user.role === "banned";
  const isSuspended = user.role === "suspended" && !!user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
  const isPlaceholder = user.email.endsWith("@placeholder.com");
  const isSynthetic = isPlaceholder;
  const effectiveUser = { ...user, isDeleted: localDeleted };
  const status = getStatus(effectiveUser);

  async function apply(action: string) {
    setLoading(true);
    setMsg(null);
    setResetLink(null);
    const res = await fetch(`/api/admin/users/${user.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, suspendDays }),
    });
    const data = await res.json();
    setLoading(false);
    if (action === "reset-password") {
      if (data.resetUrl) setResetLink(data.resetUrl);
      setMsg(data.message || (data.emailSent ? "Reset email sent ✓" : data.resetUrl ? "Reset link generated ✓" : "Done ✓"));
    } else {
      setMsg(action === "warn" ? "Warning sent ✓" : "Done ✓");
    }
    router.refresh();
  }

  async function deleteUser() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`Error: ${(data as { error?: string }).error ?? res.statusText}`);
        setConfirmDelete(false);
        return;
      }
      setLocalDeleted(true);
      setConfirmDelete(false);
      setMsg("Deleted ✓");
      router.refresh();
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : "Network error"}`);
      setConfirmDelete(false);
    } finally {
      setLoading(false);
    }
  }

  async function saveUsername() {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMsg("Username updated ✓");
      router.refresh();
    } else {
      setMsg(data.error ?? "Failed to update username");
    }
  }

  async function toggleHideFromLeaderboard() {
    const next = !hideFromLeaderboard;
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideFromLeaderboard: next }),
    });
    setLoading(false);
    if (res.ok) {
      setHideFromLeaderboard(next);
      setMsg(next ? "Hidden from leaderboard ✓" : "Visible on leaderboard ✓");
    }
  }

  return (
    <>
      <tr
        className={`transition-colors cursor-pointer ${open ? "bg-surface-raised" : "hover:bg-surface-raised/40"}`}
        onClick={() => { setOpen((v) => !v); setMsg(null); }}
      >
        {/* Username */}
        <td className="px-4 py-3 font-medium text-foreground">
          <Link href={`/profile/${user.username}`} target="_blank" className="hover:text-brand" onClick={(e) => e.stopPropagation()}>
            {user.username}
          </Link>
        </td>

        {/* Type */}
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${isSynthetic ? "bg-surface-overlay text-foreground-muted border-border" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
            {isSynthetic ? "Synthetic" : "Real"}
          </span>
        </td>

        {/* Email */}
        <td className="px-4 py-3 text-foreground-muted text-xs">{user.email}</td>

        {/* Role */}
        <td className="px-4 py-3 text-foreground-muted text-xs">{user.role}</td>

        {/* Status */}
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs border whitespace-nowrap ${status.style}`}>
            {status.label}
          </span>
        </td>

        {/* ELO */}
        <td className="px-4 py-3 text-foreground-muted text-sm">{user.elo}</td>

        {/* W/L */}
        <td className="px-4 py-3 text-foreground-muted text-sm whitespace-nowrap">{user.wins}W / {user.losses}L</td>

        {/* Joined */}
        <td className="px-4 py-3 text-foreground-muted text-xs whitespace-nowrap">
          {new Date(user.createdAt).toLocaleDateString()}
        </td>

        {/* Actions toggle */}
        <td className="px-4 py-3 text-xs text-brand">
          {open ? "▲ Close" : "▼ Actions"}
        </td>
      </tr>

      {open && (
        <tr className="bg-surface-raised border-t border-border">
          <td colSpan={9} className="px-6 py-4">
            <div className="flex flex-wrap gap-6 items-start">
              {/* Username editing (if synthetic) */}
              {isPlaceholder && !localDeleted && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Username</label>
                  <div className="flex items-center gap-2">
                    <input
                      className="text-sm rounded border border-border bg-background text-foreground px-2 py-1.5 w-32"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); saveUsername(); }}
                      disabled={loading}
                      className="px-3 py-1.5 text-sm rounded bg-brand/10 border border-brand/30 text-brand disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Action reason */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Reason</label>
                <input
                  className="text-sm rounded border border-border bg-background text-foreground px-2 py-1.5 w-48"
                  placeholder="Optional reason for action"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-5">
                {!localDeleted ? (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); apply("warn"); }}
                        disabled={loading}
                        className="px-3 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50"
                      >
                        Warn
                      </button>
                      
                      {/* Suspend / lift */}
                      {!isSuspended && !isBanned && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); apply("suspend"); }}
                            disabled={loading}
                            className="px-3 py-1.5 text-sm rounded bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 disabled:opacity-50"
                          >
                            Suspend
                          </button>
                          <select
                            value={suspendDays}
                            onChange={(e) => setSuspendDays(Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm rounded border border-border bg-background text-foreground px-2 py-1.5"
                          >
                            {SUSPEND_OPTIONS.map((o) => (
                              <option key={o.label} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </>
                      )}
                      {(isSuspended || isBanned) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); apply("unban"); }}
                          disabled={loading}
                          className="px-3 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50"
                        >
                          {isBanned ? "Unban" : "Lift Suspension"}
                        </button>
                      )}

                      {/* Ban */}
                      {!isBanned && (
                        <button
                          onClick={(e) => { e.stopPropagation(); apply("ban"); }}
                          disabled={loading}
                          className="px-3 py-1.5 text-sm rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 disabled:opacity-50"
                        >
                          Ban
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Reset password */}
                      <button
                        onClick={(e) => { e.stopPropagation(); apply("reset-password"); }}
                        disabled={loading}
                        className="px-3 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50"
                      >
                        Reset Password
                      </button>

                      {/* Hide from leaderboard toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleHideFromLeaderboard(); }}
                        disabled={loading}
                        title={hideFromLeaderboard ? "Show on leaderboard" : "Hide from leaderboard"}
                        className={`px-3 py-1.5 text-sm rounded border disabled:opacity-50 ${hideFromLeaderboard ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-surface border-border text-foreground-muted hover:text-foreground"}`}
                      >
                        {hideFromLeaderboard ? "Show on Leaderboard" : "Hide from Leaderboard"}
                      </button>

                      {/* Delete */}
                      {!confirmDelete ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                          className="px-3 py-1.5 text-sm rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20"
                        >
                          Delete Account
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteUser(); }}
                            disabled={loading}
                            className="px-3 py-1.5 text-sm rounded bg-danger text-white border-danger disabled:opacity-50"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                            className="px-3 py-1.5 text-sm rounded bg-surface border border-border text-foreground-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-foreground-muted italic">User is deleted</span>
                )}

                {msg && (
                  <p className="text-sm text-foreground-muted">{msg}</p>
                )}
                {resetLink && (
                  <div className="mt-2">
                    <label className="text-xs text-foreground-muted font-medium">Reset Link:</label>
                    <input
                      readOnly
                      value={resetLink}
                      className="mt-1 text-sm rounded border border-border bg-background text-foreground px-2 py-1.5 w-full font-mono"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

