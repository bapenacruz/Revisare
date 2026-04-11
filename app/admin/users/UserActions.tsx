"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  role: string;
  suspendedUntil: string | null;
}

export function UserActions({ user }: { user: User }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(7);

  async function apply(action: string) {
    setLoading(true);
    await fetch(`/api/admin/users/${user.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, suspendDays: days }),
    });
    setLoading(false);
    setOpen(false);
    setReason("");
    router.refresh();
  }

  const isBanned = user.role === "banned";
  const isSuspended = user.role === "suspended";

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-brand hover:underline"
      >
        Actions
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-[--radius] border border-border bg-surface-raised w-56">
          <input
            className="w-full text-xs rounded border border-border bg-background text-foreground p-1.5 mb-2"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => apply("warn")}
              disabled={loading}
              className="px-2 py-1 text-xs rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50 text-left"
            >
              Issue Warning
            </button>
            {!isSuspended && !isBanned && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => apply("suspend")}
                  disabled={loading}
                  className="flex-1 px-2 py-1 text-xs rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50 text-left"
                >
                  Suspend
                </button>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="text-xs rounded border border-border bg-background text-foreground p-1"
                >
                  {[7, 14, 30, 90].map((d) => (
                    <option key={d} value={d}>
                      {d}d
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isBanned && (
              <button
                onClick={() => apply("ban")}
                disabled={loading}
                className="px-2 py-1 text-xs rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 disabled:opacity-50 text-left"
              >
                Permanent Ban
              </button>
            )}
            {(isBanned || isSuspended) && (
              <button
                onClick={() => apply("unban")}
                disabled={loading}
                className="px-2 py-1 text-xs rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50 text-left"
              >
                Remove Restriction
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
