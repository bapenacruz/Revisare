"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

type Tab = "judging" | "assessment";

export default function JudgePromptsPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("judging");

  // Judging prompt state
  const [prompt, setPrompt] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Assessment prompt state
  const [assessPrompt, setAssessPrompt] = useState("");
  const [assessUpdatedAt, setAssessUpdatedAt] = useState<string | null>(null);
  const [assessSaving, setAssessSaving] = useState(false);
  const [assessResetting, setAssessResetting] = useState(false);

  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || (session?.user as { role?: string })?.role !== "admin") {
      redirect("/auth/login");
    }
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  async function loadAll() {
    setLoading(true);
    try {
      const [judgeRes, assessRes] = await Promise.all([
        fetch("/api/admin/judge-prompts"),
        fetch("/api/admin/assess-prompt"),
      ]);
      if (judgeRes.ok) {
        const data = await judgeRes.json();
        setPrompt(data.prompt ?? "");
        setUpdatedAt(data.updatedAt ?? null);
      }
      if (assessRes.ok) {
        const data = await assessRes.json();
        setAssessPrompt(data.prompt ?? "");
        setAssessUpdatedAt(data.updatedAt ?? null);
      }
    } catch {
      setMessage({ text: "Failed to load prompts.", ok: false });
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
        const data = await res.json();
        setPrompt(data.prompt ?? "");
        setUpdatedAt(null);
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

  async function saveAssess() {
    setAssessSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/assess-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: assessPrompt }),
      });
      if (res.ok) {
        setMessage({ text: "Assessment prompt saved.", ok: true });
        setAssessUpdatedAt(new Date().toISOString());
        setTimeout(() => setMessage(null), 4000);
      } else {
        throw new Error();
      }
    } catch {
      setMessage({ text: "Save failed.", ok: false });
    } finally {
      setAssessSaving(false);
    }
  }

  async function resetAssess() {
    if (!confirm("Reset assessment prompt to built-in defaults? Your current prompt will be lost.")) return;
    setAssessResetting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/assess-prompt", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setAssessPrompt(data.prompt ?? "");
        setAssessUpdatedAt(null);
        setMessage({ text: "Reset to defaults.", ok: true });
        setTimeout(() => setMessage(null), 4000);
      } else {
        throw new Error();
      }
    } catch {
      setMessage({ text: "Reset failed.", ok: false });
    } finally {
      setAssessResetting(false);
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
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["judging", "assessment"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setMessage(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-brand text-brand"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {tab === "judging" ? "Judge Prompts" : "Assessment Prompt"}
          </button>
        ))}
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

      {activeTab === "judging" && (
        <>
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

          <div className="flex items-center justify-between text-xs text-foreground-subtle">
            <span>{prompt.length.toLocaleString()} characters</span>
            {updatedAt && <span>Last saved {new Date(updatedAt).toLocaleString()}</span>}
          </div>
        </>
      )}

      {activeTab === "assessment" && (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Assessment Prompt</h1>
              <p className="text-sm text-foreground-muted mt-1 max-w-xl">
                Controls how the AI analyses a user&apos;s debate history on their profile page.
                The confidence block (debate count, ideological category coverage) is always
                auto-appended by the system — edit the instructions above it only.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={resetAssess} disabled={assessResetting} variant="secondary" size="sm">
                {assessResetting ? "Resetting…" : "Reset to Defaults"}
              </Button>
              <Button onClick={saveAssess} disabled={assessSaving} size="sm">
                {assessSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>

          <Card>
            <CardBody className="p-0">
              <textarea
                value={assessPrompt}
                onChange={(e) => setAssessPrompt(e.target.value)}
                className="w-full min-h-[600px] p-4 bg-transparent font-mono text-sm text-foreground leading-relaxed resize-y focus:outline-none rounded-[--radius]"
                spellCheck={false}
              />
            </CardBody>
          </Card>

          <div className="flex items-center justify-between text-xs text-foreground-subtle">
            <span>{assessPrompt.length.toLocaleString()} characters</span>
            {assessUpdatedAt && <span>Last saved {new Date(assessUpdatedAt).toLocaleString()}</span>}
          </div>
        </>
      )}
    </div>
  );
}