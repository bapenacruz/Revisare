"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function JudgePromptsPage() {
  const { data: session, status } = useSession();
  const [prompt, setPrompt] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || (session?.user as { role?: string })?.role !== "admin") {
      redirect("/auth/login");
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/judge-prompts");
      if (res.ok) {
        const data = await res.json();
        setPrompt(data.prompt ?? "");
        setUpdatedAt(data.updatedAt ?? null);
      }
    } catch {
      setMessage({ text: "Failed to load prompt.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/judge-prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        setMessage({ text: "Saved successfully.", ok: true });
        setUpdatedAt(new Date().toISOString());
        setTimeout(() => setMessage(null), 4000);
      } else {
        throw new Error();
      }
    } catch {
      setMessage({ text: "Save failed.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Reset to built-in defaults? Your current prompt will be lost.")) return;
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/judge-prompts", { method: "DELETE" });
      if (res.ok) {
        await load();
        setMessage({ text: "Reset to defaults.", ok: true });
        setTimeout(() => setMessage(null), 4000);
      } else {
        throw new Error();
      }
    } catch {
      setMessage({ text: "Reset failed.", ok: false });
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 flex items-center justify-center">
        <p className="text-foreground-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Judge Prompts</h1>
          <p className="text-sm text-foreground-muted mt-1 max-w-xl">
            This is the complete judging logic used by all three AI judges (Grok, Claude, GPT-4.1-mini).
            Edit freely — the debater names, category, and JSON output schema are auto-injected at runtime.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={reset} disabled={resetting} variant="secondary" size="sm">
            {resetting ? "Resetting…" : "Reset to Defaults"}
          </Button>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Status */}
      {message && (
        <div className={`px-4 py-2.5 rounded-[--radius] text-sm font-medium ${
          message.ok
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            : "bg-danger/10 border border-danger/20 text-danger"
        }`}>
          {message.text}
        </div>
      )}

      {/* Editor */}
      <Card>
        <CardBody className="p-0">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full min-h-[600px] p-4 bg-transparent font-mono text-sm text-foreground leading-relaxed resize-y focus:outline-none rounded-[--radius]"
            spellCheck={false}
          />
        </CardBody>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-foreground-subtle">
        <span>{prompt.length.toLocaleString()} characters</span>
        {updatedAt && <span>Last saved {new Date(updatedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}