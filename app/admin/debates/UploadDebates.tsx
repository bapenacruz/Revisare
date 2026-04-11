"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { ImportResult } from "@/app/api/admin/debates/bulk-import/route";

const TEMPLATE = [
  {
    motion: "This House Believes that social media does more harm than good",
    category_slug: "technology",
    format: "standard",
    ranked: false,
    debaterA: { username: "alice", side: "proposition" },
    debaterB: { username: "bob", side: "opposition" },
    turns: [
      {
        username: "alice",
        roundName: "opening",
        content: "Social media has fundamentally damaged public discourse by optimising for outrage over truth. Studies show polarisation has increased dramatically since 2012 — the year smartphone adoption crossed 50%.",
      },
      {
        username: "bob",
        roundName: "opening",
        content: "Social media has connected billions of people who would otherwise be isolated, enabled grassroots movements, and given marginalised voices a platform they never had before.",
      },
      {
        username: "alice",
        roundName: "rebuttal",
        content: "My opponent highlights connectivity, but fails to address the mental health crisis. The Surgeon General's 2023 advisory specifically cited social media as a driver of adolescent anxiety and depression.",
      },
      {
        username: "bob",
        roundName: "rebuttal",
        content: "Correlation is not causation. Multiple meta-analyses show only small effect sizes between social media use and mental health outcomes — other factors like economic anxiety and school pressure are far stronger predictors.",
      },
      {
        username: "alice",
        roundName: "closing",
        content: "The evidence is clear: misinformation spreads six times faster than accurate information on social platforms (MIT 2018). The net harm to democratic discourse and mental health outweighs the connectivity benefits.",
      },
      {
        username: "bob",
        roundName: "closing",
        content: "Banning or severely restricting social media would silence the very voices that benefit most — activists in authoritarian regimes, disabled people who rely on online communities, rural communities with no other connection.",
      },
    ],
    winner_username: "alice",
    completed_at: "2025-01-15T10:00:00Z",
  },
  {
    motion: "This House Would make voting mandatory",
    category_slug: "politics",
    format: "quick",
    ranked: false,
    debaterA: { username: "charlie", side: "proposition" },
    debaterB: { username: "diana", side: "opposition" },
    turns: [
      {
        username: "charlie",
        roundName: "opening",
        content: "Mandatory voting ensures governments represent the full population, not just those motivated to vote. Australia has had compulsory voting since 1924 with turnout consistently above 90% and no evidence of democratic harm.",
      },
      {
        username: "diana",
        roundName: "opening",
        content: "Forcing citizens to vote violates the fundamental right to political non-participation. Free expression necessarily includes the right to abstain — a right recognised under international human rights frameworks.",
      },
      {
        username: "charlie",
        roundName: "rebuttal",
        content: "The abstention argument is a red herring — mandatory voting systems allow blank ballots, preserving the right to say 'none of the above'. What they prevent is politicians ignoring low-turnout groups.",
      },
      {
        username: "diana",
        roundName: "rebuttal",
        content: "Uninformed compelled voters reduce election quality. Research shows forced voters exhibit lower political knowledge and more susceptibility to propaganda — hardly the informed citizenry democracy requires.",
      },
    ],
    winner_username: "charlie",
    completed_at: "2025-02-20T14:30:00Z",
  },
];

export function UploadDebates() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<{ created: number; errors: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debate-import-template.json";
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
      setFileError("JSON must be an array of debate objects.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/admin/debates/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        setFileError(data.error ?? "Upload failed");
      } else {
        setResults(data.results);
        setSummary({ created: data.created, errors: data.errors });
        router.refresh();
      }
    } catch {
      setFileError("Network error. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border bg-surface text-foreground-muted hover:text-foreground hover:border-brand/40 transition-colors"
        >
          <Download size={14} />
          Download Template
        </button>

        <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border cursor-pointer transition-colors ${uploading ? "border-border bg-surface text-foreground-muted opacity-60 cursor-not-allowed" : "border-brand/60 bg-brand/10 text-brand hover:bg-brand/20"}`}>
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload size={14} />
              Upload JSON
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {fileError && (
        <p className="text-xs text-danger">{fileError}</p>
      )}

      {summary && (
        <div className="text-xs text-foreground-muted">
          Import complete: <span className="text-success font-semibold">{summary.created} created</span>
          {summary.errors > 0 && (
            <>, <span className="text-danger font-semibold">{summary.errors} failed</span></>
          )}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1 max-h-80 overflow-y-auto border border-border rounded-[--radius] p-2">
          {results.map((r) => (
            <div key={r.index} className="flex items-start gap-2 text-xs">
              {r.status === "created" ? (
                <CheckCircle size={13} className="text-success shrink-0 mt-0.5" />
              ) : (
                <XCircle size={13} className="text-danger shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span className="text-foreground font-medium truncate block">{r.motion}</span>
                {r.status === "created" && r.createdUsers && r.createdUsers.length > 0 && (
                  <span className="text-foreground-muted">New users created: {r.createdUsers.join(", ")}</span>
                )}
                {r.status === "error" && (
                  <span className="text-danger">{r.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
