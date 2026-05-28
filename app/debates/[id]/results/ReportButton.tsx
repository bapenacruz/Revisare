"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

const REPORT_TYPES = [
  "Abusive Language",
  "Cheating / Collusion",
  "Harassment",
  "Inappropriate Content",
  "Misinformation",
  "Spam",
  "Other",
];

export function ReportButton({ challengeId }: { challengeId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/debates/${challengeId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to submit report.");
        setResult("error");
      } else {
        setResult("success");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setType("");
    setDescription("");
    setResult(null);
    setErrorMsg("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-foreground-muted hover:text-danger transition-colors flex items-center gap-1.5"
      >
        <Flag size={13} />
        Report to Moderators
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="bg-surface border border-border rounded-[--radius-lg] w-full max-w-md shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Flag size={15} className="text-danger" />
                <h2 className="text-base font-bold text-foreground">Report to Moderators</h2>
              </div>
              <button onClick={close} className="text-foreground-subtle hover:text-foreground transition-colors p-1 rounded">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {result === "success" ? (
                <div className="text-center py-6">
                  <p className="text-sm font-semibold text-foreground mb-1">Report submitted</p>
                  <p className="text-sm text-foreground-muted">Our moderation team will review this debate. Thank you.</p>
                  <Button onClick={close} size="sm" className="mt-4">Close</Button>
                </div>
              ) : (
                <form onSubmit={submit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                      Category <span className="text-danger">*</span>
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-[--radius] bg-surface-raised border border-border text-foreground text-sm focus:outline-none focus:border-brand transition-colors"
                    >
                      <option value="" disabled>Select a category…</option>
                      {REPORT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                      Description <span className="text-danger">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                      required
                      rows={4}
                      placeholder="Describe the issue in detail…"
                      className="w-full px-3 py-2 rounded-[--radius] bg-surface-raised border border-border text-foreground text-sm placeholder:text-foreground-subtle resize-none focus:outline-none focus:border-brand transition-colors"
                    />
                    <span className="text-xs text-foreground-subtle text-right">{description.length}/1000</span>
                  </div>

                  {result === "error" && (
                    <p className="text-sm text-danger">{errorMsg}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={close} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submitting || !type || description.trim().length < 10}
                      className="bg-danger hover:bg-danger/80 text-white border-danger"
                    >
                      {submitting ? "Submitting…" : "Submit Report"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
