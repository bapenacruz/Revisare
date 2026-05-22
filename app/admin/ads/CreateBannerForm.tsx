"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { TargetingPicker } from "./TargetingPicker";

export function CreateBannerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [targetCompassQuadrants, setTargetCompassQuadrants] = useState<string[]>([]);
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [targetStates, setTargetStates] = useState<string[]>([]);
  const [targetUsernames, setTargetUsernames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg("Image must be under 2 MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImageDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
    setMsg(null);
  }

  async function create() {
    if (!imageDataUrl) { setMsg("Please upload an image."); return; }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/ad-banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        businessName: businessName || null,
        linkUrl: linkUrl || null,
        altText: altText || null,
        targetRegions,
        targetCompassQuadrants,
        targetCountries,
        targetStates,
        targetUsernames,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setImageDataUrl(null);
      setBusinessName("");
      setLinkUrl("");
      setAltText("");
      setTargetRegions([]);
      setTargetCompassQuadrants([]);
      setTargetCountries([]);
      setTargetStates([]);
      setTargetUsernames([]);
      setMsg("Banner created ✓");
      router.refresh();
      setOpen(false);
    } else {
      const j = await res.json();
      setMsg(j.error ?? "Error");
    }
  }

  return (
    <div className="mb-4 border border-border rounded-[--radius] overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface text-sm font-medium text-foreground hover:bg-surface-raised transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>+ Create New Banner</span>
        <span className="text-foreground-muted text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4 bg-surface border-t border-border flex flex-wrap gap-4 items-start">
          {/* Image upload */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Image *</label>
            <div className="mb-1 p-2 rounded border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-700 dark:text-amber-400 leading-snug space-y-0.5">
              <p className="font-semibold">📐 Banner guidelines</p>
              <p>• Recommended: <strong>1200 × 300 px</strong> (4:1 ratio) or <strong>1200 × 400 px</strong> (3:1)</p>
              <p>• Minimum width: <strong>600 px</strong> — narrower images will look blurry</p>
              <p>• File size: <strong>under 2 MB</strong> (JPG or PNG preferred)</p>
              <p>• Text should be large and centered — banner will be cropped on small screens</p>
            </div>
            {imageDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageDataUrl} alt="Preview" className="h-24 max-w-[200px] object-cover rounded border border-border" />
                <button onClick={() => fileRef.current?.click()}
                  className="px-3 py-1 text-xs rounded border border-border text-foreground-muted hover:text-foreground">
                  Replace
                </button>
              </>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="h-24 w-[200px] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded text-foreground-muted hover:border-brand/50 hover:text-brand transition-colors">
                <span className="text-2xl">🖼️</span>
                <span className="text-xs">Click to upload</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          <div className="flex flex-col gap-1 w-56">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Business Name</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={businessName}
              onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Corp" />
          </div>

          <div className="flex flex-col gap-1 w-56">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Link URL</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>

          <div className="flex flex-col gap-1 w-48">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Alt Text</label>
            <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={altText}
              onChange={(e) => setAltText(e.target.value)} placeholder="Describe the image…" />
          </div>

          <div className="w-full">
            <TargetingPicker
              regions={targetRegions}
              quadrants={targetCompassQuadrants}
              countries={targetCountries}
              states={targetStates}
              usernames={targetUsernames}
              onRegionsChange={setTargetRegions}
              onQuadrantsChange={setTargetCompassQuadrants}
              onCountriesChange={setTargetCountries}
              onStatesChange={setTargetStates}
              onUsernamesChange={setTargetUsernames}
            />
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={create} disabled={saving}
              className="px-4 py-1.5 text-sm rounded bg-brand text-white disabled:opacity-50 whitespace-nowrap">
              {saving ? "Creating..." : "Create Banner"}
            </button>
            {msg && <p className="text-xs text-foreground-muted">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
