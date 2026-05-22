"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { AdImportResult } from "@/app/api/admin/ads/bulk-import/route";

const TEMPLATE = [
  {
    motion: "Switch to renewable energy for better future",
    proponent_name: "GreenEnergy Co.",
    opponent_name: "OldFuel Corp.",
    ad_category_slug: null,
    link_url: "https://example.com/green-energy",
    turns: [
      {
        speaker: "proponent",
        roundName: "opening",
        content: "Renewable energy is no longer experimental — it is the cheapest form of electricity ever produced. Solar and wind now undercut fossil fuels on cost in 90% of global markets. Switching now locks in lower energy prices for decades, creates millions of jobs, and eliminates the geopolitical vulnerability that comes from importing oil and gas.",
      },
      {
        speaker: "opponent",
        roundName: "opening",
        content: "The transition to renewables, however well-intentioned, carries enormous costs: grid instability, the loss of baseload power, and billions in stranded assets from premature fossil fuel retirement. Developing economies in particular cannot afford to leapfrog proven, reliable infrastructure in favour of an intermittent energy grid dependent on battery storage technology that does not yet exist at scale.",
      },
      {
        speaker: "proponent",
        roundName: "crossfire",
        content: "Can you name a single grid that has collapsed because renewables crossed 50% penetration? South Australia operates above 70% renewables without blackouts. What evidence supports your instability claim?",
      },
      {
        speaker: "opponent",
        roundName: "crossfire",
        content: "Your cost figures assume mature markets with existing grid infrastructure. How do you account for the $3 trillion estimated cost of upgrading transmission grids globally — a cost that falls on consumers, not renewable developers?",
      },
      {
        speaker: "proponent",
        roundName: "rebuttal",
        content: "The grid upgrade cost argument proves my case: the $3 trillion figure is spread over 30 years and is dwarfed by the $4.7 trillion per year the IMF calculates that governments currently spend subsidising fossil fuels. Redirecting even a fraction of that subsidy to grid modernisation pays for itself in reduced fuel import bills within a decade.",
      },
      {
        speaker: "opponent",
        roundName: "rebuttal",
        content: "IMF subsidy figures include implicit carbon costs — a political calculation, not a market price. Real-world energy transitions in Germany and California show that consumer prices rise sharply when mandated renewable adoption outpaces grid adaptation. The proponent has not answered how communities dependent on fossil fuel industries sustain themselves during a forced transition.",
      },
      {
        speaker: "proponent",
        roundName: "summary",
        content: "The evidence is clear: renewables are cheaper, cleaner, and increasingly more reliable than fossil fuels. Transition costs are real but manageable and far smaller than the cost of inaction on climate. The question is not whether to switch — it is how fast. The answer is: as fast as grid investments allow. Vote for the future.",
      },
      {
        speaker: "opponent",
        roundName: "summary",
        content: "A managed transition is sensible. A rushed, ideologically driven switch ignores the communities, grids, and developing economies that are not ready. The proposition has offered no credible pathway for the 800 million people still without reliable electricity. Energy security requires pragmatism, not slogans.",
      },
    ],
    created_at: "2025-03-10T09:00:00Z",
  },
  {
    motion: "AI-powered legal tools make justice more accessible",
    proponent_name: "LexAI Legal",
    opponent_name: "Bar Association Rep.",
    ad_category_slug: null,
    link_url: null,
    turns: [
      {
        speaker: "proponent",
        roundName: "opening",
        content: "Two-thirds of people who need legal help cannot afford a lawyer. AI legal tools change that equation permanently. Document analysis that once cost $500 an hour now costs cents. Contract review, tenant rights advice, immigration form preparation — tasks that kept justice out of reach for ordinary people are now available at scale. LexAI Legal has already helped over 400,000 users who would otherwise have gone unrepresented.",
      },
      {
        speaker: "opponent",
        roundName: "opening",
        content: "Accessible in theory does not mean accurate in practice. AI legal tools trained on historical data perpetuate the biases baked into that data. More dangerously, they give non-lawyers the dangerous confidence of expert advice without the professional accountability that expert advice requires. A doctor who misdiagnoses faces consequences. An AI that gives wrong legal advice faces none.",
      },
      {
        speaker: "proponent",
        roundName: "crossfire",
        content: "You raise accountability — but unrepresented litigants today receive zero accountability from anyone. Isn't imperfect AI guidance categorically better than the current situation where a tenant facing eviction has no option at all?",
      },
      {
        speaker: "opponent",
        roundName: "crossfire",
        content: "Your 400,000 users figure — how many received advice that led to adverse legal outcomes? And how would you even know, given that AI tools typically do not track downstream consequences of their guidance?",
      },
      {
        speaker: "proponent",
        roundName: "rebuttal",
        content: "The accountability gap my opponent identifies applies to the entire self-help legal industry — books, websites, and clinics. The appropriate response is better transparency standards for AI tools, not prohibition. Our platform discloses confidence levels, flags jurisdictional limitations, and recommends escalation to attorneys for complex matters. Perfection is not the standard; improvement is.",
      },
      {
        speaker: "opponent",
        roundName: "rebuttal",
        content: "Disclosure of confidence levels does not protect a user who does not understand what that disclosure means. Legal error is not like a bad restaurant recommendation — it can result in deportation, incarceration, or financial ruin. The legal profession's gatekeeping exists precisely because the stakes are too high to leave to tools that optimise for engagement, not outcomes.",
      },
      {
        speaker: "proponent",
        roundName: "summary",
        content: "My opponent prefers a system where justice is inaccessible over one where it is imperfectly accessible. That is not a defence of justice — it is a defence of the legal profession's monopoly. AI tools, properly regulated, expand access to people the current system has abandoned. The status quo is not working. AI is making it better.",
      },
      {
        speaker: "opponent",
        roundName: "summary",
        content: "Expansion of access is a worthy goal. But access to bad advice is worse than no advice when the consequences are irreversible. The solution is properly funded legal aid, not liability-free AI tools. Real justice requires real accountability.",
      },
    ],
    created_at: "2025-04-05T14:00:00Z",
  },
];

export function UploadAds() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<AdImportResult[] | null>(null);
  const [summary, setSummary] = useState<{ created: number; errors: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ad-import-template.json";
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
      setFileError("JSON must be an array of ad objects.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/admin/ads/bulk-import", {
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
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border bg-surface text-foreground-muted hover:text-foreground hover:border-brand/40 transition-colors"
        >
          <Download size={14} />
          Download Template
        </button>

        <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border cursor-pointer transition-colors ${
          uploading
            ? "border-border bg-surface text-foreground-muted opacity-60 cursor-not-allowed"
            : "border-brand/60 bg-brand/10 text-brand hover:bg-brand/20"
        }`}>
          {uploading ? (
            <><Loader2 size={14} className="animate-spin" /> Uploading...</>
          ) : (
            <><Upload size={14} /> Upload JSON</>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {fileError && (
        <p className="text-sm text-danger flex items-center gap-1.5">
          <XCircle size={14} /> {fileError}
        </p>
      )}

      {summary && (
        <p className="text-sm text-foreground-muted">
          Import complete: <span className="text-green-400">{summary.created} created</span>
          {summary.errors > 0 && <>, <span className="text-danger">{summary.errors} errors</span></>}
        </p>
      )}

      {results && results.some((r) => r.status === "error") && (
        <div className="rounded border border-border overflow-hidden text-xs">
          {results.filter((r) => r.status === "error").map((r) => (
            <div key={r.index} className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-0 bg-danger/5">
              <XCircle size={13} className="text-danger mt-0.5 shrink-0" />
              <span className="text-foreground-muted">
                <span className="font-medium text-foreground">#{r.index + 1} {r.motion}</span> — {r.error}
              </span>
            </div>
          ))}
        </div>
      )}

      {results && results.some((r) => r.status === "created") && (
        <div className="rounded border border-border overflow-hidden text-xs">
          {results.filter((r) => r.status === "created").map((r) => (
            <div key={r.index} className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0">
              <CheckCircle size={13} className="text-green-400 shrink-0" />
              <span className="text-foreground-muted line-clamp-1">{r.motion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
