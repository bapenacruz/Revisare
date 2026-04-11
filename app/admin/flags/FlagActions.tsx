"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Flag {
  id: string;
  type: string;
  description: string | null;
  debateId: string | null;
  flaggedUsername: string | null;
  reporterUsername: string | null;
  status: string;
  createdAt: string;
}

export function FlagActions({ flag }: { flag: Flag }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(status: "reviewed" | "dismissed") {
    setLoading(true);
    await fetch(`/api/admin/flags/${flag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution }),
    });
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  if (flag.status !== "pending") {
    return (
      <span className="text-xs text-foreground-muted capitalize">{flag.status}</span>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-brand hover:underline mr-3"
      >
        Review
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-[--radius] border border-border bg-surface-raised">
          <textarea
            className="w-full text-xs rounded border border-border bg-background text-foreground p-2 resize-none"
            rows={2}
            placeholder="Resolution note (optional)"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => submit("reviewed")}
              disabled={loading}
              className="px-3 py-1 text-xs rounded bg-brand text-white disabled:opacity-50"
            >
              Mark Reviewed
            </button>
            <button
              onClick={() => submit("dismissed")}
              disabled={loading}
              className="px-3 py-1 text-xs rounded bg-surface border border-border text-foreground-muted hover:text-foreground disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
