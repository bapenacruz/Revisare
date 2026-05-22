"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { TargetingPicker } from "./TargetingPicker";

interface AdBanner {
  id: string;
  businessName: string | null;
  imageDataUrl: string;
  linkUrl: string | null;
  altText: string | null;
  isActive: boolean;
  createdAt: Date;
  targetRegions: unknown;
  targetCompassQuadrants: unknown;
  targetCountries: unknown;
  targetStates: unknown;
  targetUsernames: unknown;
}

export function BannerRow({ banner }: { banner: AdBanner }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState(banner.imageDataUrl);
  const [businessName, setBusinessName] = useState(banner.businessName ?? "");
  const [linkUrl, setLinkUrl] = useState(banner.linkUrl ?? "");
  const [altText, setAltText] = useState(banner.altText ?? "");
  const [isActive, setIsActive] = useState(banner.isActive);
  const [targetRegions, setTargetRegions] = useState<string[]>(
    Array.isArray(banner.targetRegions) ? (banner.targetRegions as string[]) : []
  );
  const [targetCompassQuadrants, setTargetCompassQuadrants] = useState<string[]>(
    Array.isArray(banner.targetCompassQuadrants) ? (banner.targetCompassQuadrants as string[]) : []
  );
  const [targetCountries, setTargetCountries] = useState<string[]>(
    Array.isArray(banner.targetCountries) ? (banner.targetCountries as string[]) : []
  );
  const [targetStates, setTargetStates] = useState<string[]>(
    Array.isArray(banner.targetStates) ? (banner.targetStates as string[]) : []
  );
  const [targetUsernames, setTargetUsernames] = useState<string[]>(
    Array.isArray(banner.targetUsernames) ? (banner.targetUsernames as string[]) : []
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localDeleted, setLocalDeleted] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg("Image must be under 2 MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImageDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/ad-banners/${banner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        businessName: businessName || null,
        linkUrl: linkUrl || null,
        altText: altText || null,
        isActive,
        targetRegions,
        targetCompassQuadrants,
        targetCountries,
        targetStates,
        targetUsernames,
      }),
    });
    setSaving(false);
    if (res.ok) { setMsg("Saved ✓"); router.refresh(); }
    else { const j = await res.json(); setMsg(j.error ?? "Error"); }
  }

  async function deleteBanner() {
    setDeleting(true);
    const res = await fetch(`/api/admin/ad-banners/${banner.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    if (res.ok) { setLocalDeleted(true); }
    else { const j = await res.json(); setMsg(j.error ?? "Error"); }
  }

  if (localDeleted) return null;

  return (
    <>
      <tr
        className={`transition-colors cursor-pointer ${open ? "bg-surface-raised" : "hover:bg-surface-raised/40"}`}
        onClick={() => { setOpen((v) => !v); setMsg(null); }}
      >
        <td className="px-2 py-2 text-xs text-foreground-muted max-w-[120px] truncate">
          {banner.businessName ?? <span className="opacity-40">—</span>}
        </td>
        <td className="px-2 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageDataUrl} alt={altText ?? ""} className="h-12 w-20 object-cover rounded border border-border" />
        </td>
        <td className="px-2 py-2 text-xs text-foreground-muted max-w-[120px] truncate">
          {linkUrl || <span className="opacity-40">—</span>}
        </td>
        <td className="px-2 py-2 text-xs text-foreground-muted max-w-[120px] truncate">
          {altText || <span className="opacity-40">—</span>}
        </td>
        <td className="px-2 py-2">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${isActive ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-surface-overlay text-foreground-muted border-border"}`}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-2 py-2 text-xs text-foreground-muted whitespace-nowrap">
          {new Date(banner.createdAt).toLocaleDateString()}
        </td>
        <td className="px-2 py-2 text-xs text-brand whitespace-nowrap">{open ? "▲ Close" : "▼ Edit"}</td>
      </tr>

      {open && (
        <tr className="bg-surface-raised border-t border-border">
          <td colSpan={7} className="px-6 py-4">
            <div className="flex flex-wrap gap-4 items-start">
              {/* Image preview + replace */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Image</label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageDataUrl} alt={altText ?? "Banner"} className="h-24 max-w-[200px] object-cover rounded border border-border" />
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="px-3 py-1 text-xs rounded border border-border text-foreground-muted hover:text-foreground">
                  Replace Image
                </button>
              </div>

              <div className="flex flex-col gap-1 w-56">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Business Name</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={businessName}
                  placeholder="Acme Corp" onChange={(e) => setBusinessName(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>

              <div className="flex flex-col gap-1 w-56">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Link URL</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={linkUrl}
                  placeholder="https://…" onChange={(e) => setLinkUrl(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>

              <div className="flex flex-col gap-1 w-48">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Alt Text</label>
                <input className="text-sm rounded border border-border bg-background text-foreground p-2" value={altText}
                  placeholder="Describe the image…" onChange={(e) => setAltText(e.target.value)} onClick={(e) => e.stopPropagation()} />
              </div>

              <div className="flex flex-col gap-1 w-24">
                <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Active</label>
                <select className="text-sm rounded border border-border bg-background text-foreground p-2" value={isActive ? "yes" : "no"}
                  onChange={(e) => setIsActive(e.target.value === "yes")} onClick={(e) => e.stopPropagation()}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div className="w-full mt-2">
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
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="flex flex-col gap-2 justify-end pt-2">
                <button onClick={(e) => { e.stopPropagation(); save(); }} disabled={saving}
                  className="px-4 py-1.5 text-sm rounded bg-brand text-white disabled:opacity-50 whitespace-nowrap">
                  {saving ? "Saving..." : "Save"}
                </button>
                {!confirmDelete ? (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                    className="px-4 py-1.5 text-sm rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20">
                    Delete
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteBanner(); }} disabled={deleting}
                      className="px-3 py-1.5 text-xs rounded bg-danger text-white disabled:opacity-50">
                      {deleting ? "..." : "Confirm"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                      className="px-3 py-1.5 text-xs rounded border border-border text-foreground-muted">
                      Cancel
                    </button>
                  </div>
                )}
                {msg && <p className="text-xs text-foreground-muted">{msg}</p>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
