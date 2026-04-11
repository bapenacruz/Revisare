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
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [suspendDays, setSuspendDays] = useState(7);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
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
      setMsg(data.emailSent ? "Reset email sent ✓" : data.resetUrl ? "Reset link generated ✓" : "Done ✓");
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
      setEditingUsername(false);
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

  const btnBase = "px-3 py-1 text-xs rounded border disabled:opacity-50 whitespace-nowrap";
  const btnNeutral = `${btnBase} bg-surface border-border text-foreground-muted hover:text-foreground`;
  const btnDanger = `${btnBase} bg-danger/10 border-danger/30 text-danger hover:bg-danger/20`;
  const btnWarning = `${btnBase} bg-accent/10 border-accent/30 text-accent hover:bg-accent/20`;

  return (
    <>
      <tr className="hover:bg-surface-raised/40 transition-colors">
        {/* Username */}
        <td className="px-4 py-3 font-medium text-foreground">
          {editingUsername && isPlaceholder && !user.isDeleted ? (
            <div className="flex items-center gap-1">
              <input
                className="text-xs rounded border border-border bg-background text-foreground px-2 py-0.5 w-32"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <button onClick={saveUsername} disabled={loading} className={`${btnBase} bg-brand/10 border-brand/30 text-brand`}>Save</button>
              <button onClick={() => { setEditingUsername(false); setNewUsername(user.username); }} className={btnNeutral}>✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href={`/profile/${user.username}`} target="_blank" className="hover:text-brand">{user.username}</Link>
              {isPlaceholder && !user.isDeleted && (
                <button
                  onClick={() => setEditingUsername(true)}
                  className="text-[10px] text-foreground-muted hover:text-foreground border border-border rounded px-1 py-0.5"
                  title="Rename"
                >
                  ✎
                </button>
              )}
            </div>
          )}
        </td>

        {/* Type */}
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${isSynthetic ? "bg-surface-overlay text-foreground-muted border-border" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
            {isSynthetic ? "Synthetic" : "Real"}
          </span>
        </td>

        {/* Email */}
        <td className="px-4 py-3 text-foreground-muted text-xs">{user.email}</td>

        {/* Status */}
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${status.style}`}>
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

        {/* Actions — all inline in one row */}
        <td className="px-4 py-3">
          {localDeleted ? (
            <span className="text-xs text-foreground-muted italic">deleted</span>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Reason input */}
              <input
                className="text-xs rounded border border-border bg-background text-foreground px-2 py-1 w-28"
                placeholder="Reason…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              {/* Warn */}
              <button onClick={() => apply("warn")} disabled={loading} className={btnNeutral}>Warn</button>

              {/* Suspend / lift */}
              {!isSuspended && !isBanned && (
                <>
                  <button onClick={() => apply("suspend")} disabled={loading} className={btnWarning}>Suspend</button>
                  <select
                    value={suspendDays}
                    onChange={(e) => setSuspendDays(Number(e.target.value))}
                    className="text-xs rounded border border-border bg-background text-foreground px-1.5 py-1"
                  >
                    {SUSPEND_OPTIONS.map((o) => (
                      <option key={o.label} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </>
              )}
              {(isSuspended || isBanned) && (
                <button onClick={() => apply("unban")} disabled={loading} className={btnNeutral}>
                  {isBanned ? "Unban" : "Lift Susp."}
                </button>
              )}

              {/* Ban */}
              {!isBanned && (
                <button onClick={() => apply("ban")} disabled={loading} className={btnDanger}>Ban</button>
              )}

              {/* Delete */}
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className={btnDanger}>Delete</button>
              ) : (
                <span className="flex items-center gap-1">
                  <button onClick={deleteUser} disabled={loading} className={`${btnBase} bg-danger text-white border-danger`}>Confirm</button>
                  <button onClick={() => setConfirmDelete(false)} className={btnNeutral}>✕</button>
                </span>
              )}

              {/* Reset password */}
              <button onClick={() => apply("reset-password")} disabled={loading} className={btnNeutral}>
                Reset PWD
              </button>

              {/* Hide from leaderboard toggle */}
              <button
                onClick={toggleHideFromLeaderboard}
                disabled={loading}
                title={hideFromLeaderboard ? "Show on leaderboard" : "Hide from leaderboard"}
                className={`${btnBase} ${hideFromLeaderboard ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : btnNeutral}`}
              >
                {hideFromLeaderboard ? "Unhide" : "Hide LB"}
              </button>
            </div>
          )}

          {msg && (
            <p className="text-xs text-foreground-muted mt-1">{msg}</p>
          )}
          {resetLink && (
            <div className="mt-1">
              <input
                readOnly
                value={resetLink}
                className="text-xs rounded border border-border bg-background text-foreground px-2 py-0.5 w-64"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>
          )}
        </td>
      </tr>
    </>
  );
}

