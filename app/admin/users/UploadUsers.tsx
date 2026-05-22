"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { BulkCreateResult } from "@/app/api/admin/users/bulk-create/route";

const TEMPLATE = [
  {
    username: "alice_debates",
    email: "alice@example.com",
    password: "SecurePassword123!",
    role: "user",
    planType: "unpaid",
    bio: "Passionate about technology and ethics debates.",
    country: "United States",
  },
  {
    username: "bob_argues",
    email: "bob@example.com",
    // password omitted — a random one will be generated and returned
    role: "user",
    planType: "paid",
    bio: "Political science graduate. Loves to argue law and governance.",
    country: "United Kingdom",
  },
];

export function UploadUsers() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<BulkCreateResult[] | null>(null);
  const [summary, setSummary] = useState<{ created: number; skipped: number; errors: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-onboard-template.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setResults(null);
    setSummary(null);

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setFileError("Invalid JSON file. Could not parse.");
      e.target.value = "";
      return;
    }

    if (!Array.isArray(parsed)) {
      setFileError("JSON must be an array of user objects.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/admin/users/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        setFileError(data.error ?? "Upload failed");
      } else {
        setResults(data.results);
        setSummary({ created: data.created, skipped: data.skipped, errors: data.errors });
        router.refresh();
      }
    } catch {
      setFileError("Network error. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // Download results as JSON (includes generated passwords)
  function downloadResults() {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user-onboard-results-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border bg-surface text-foreground-muted hover:text-foreground hover:border-brand/40 transition-colors"
        >
          <Download size={14} />
          User Template
        </button>

        <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border cursor-pointer transition-colors ${uploading ? "border-border bg-surface text-foreground-muted opacity-60 cursor-not-allowed" : "border-green-500/60 bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Onboarding...
            </>
          ) : (
            <>
              <Upload size={14} />
              Onboard Users
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".json,application/json"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {fileError && (
        <p className="text-sm text-danger">{fileError}</p>
      )}

      {summary && (
        <div className="text-sm text-foreground-muted flex items-center gap-4 flex-wrap">
          <span className="text-green-400 font-medium">{summary.created} created</span>
          {summary.skipped > 0 && <span className="text-accent font-medium">{summary.skipped} skipped</span>}
          {summary.errors > 0 && <span className="text-danger font-medium">{summary.errors} errors</span>}
          {results && results.some((r) => r.generatedPassword) && (
            <button
              onClick={downloadResults}
              className="flex items-center gap-1 text-xs text-brand hover:underline"
            >
              <Download size={12} />
              Download results (includes generated passwords)
            </button>
          )}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="max-h-48 overflow-y-auto flex flex-col gap-1 text-xs">
          {results.map((r) => (
            <div key={r.index} className="flex items-center gap-2">
              {r.status === "created" ? (
                <CheckCircle size={12} className="text-green-400 shrink-0" />
              ) : r.status === "skipped" ? (
                <XCircle size={12} className="text-accent shrink-0" />
              ) : (
                <XCircle size={12} className="text-danger shrink-0" />
              )}
              <span className={`font-medium ${r.status === "created" ? "text-foreground" : "text-foreground-muted"}`}>
                {r.username}
              </span>
              {r.status === "skipped" && <span className="text-foreground-subtle">— skipped: {r.error}</span>}
              {r.status === "error" && <span className="text-danger">— {r.error}</span>}
              {r.status === "created" && r.generatedPassword && (
                <span className="text-foreground-subtle">— pwd: <code className="font-mono bg-surface-raised px-1 rounded">{r.generatedPassword}</code></span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
