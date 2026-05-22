"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, ZoomIn, ZoomOut, RotateCcw, Upload } from "lucide-react";

interface Props {
  onClose: () => void;
  onSaved: (avatarUrl: string) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const OUTPUT_SIZE = 256; // px — final circle crop

export function AvatarCropModal({ onClose, onSaved }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Drag state
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const imgEl = useRef<HTMLImageElement | null>(null);

  // Load image from file picker
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        imgEl.current = img;
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setImageSrc(src);
        setError("");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  // Draw image onto preview canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgEl.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width; // square
    ctx.clearRect(0, 0, size, size);

    // Clipping circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // Fit image to fill canvas at zoom=1, then scale
    const scale = (size / Math.min(img.naturalWidth, img.naturalHeight)) * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    const x = (size - drawW) / 2 + offset.x;
    const y = (size - drawH) / 2 + offset.y;

    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.restore();

    // Circle border
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [zoom, offset]);

  useEffect(() => { draw(); }, [draw, imageSrc]);

  // Pointer drag handlers
  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function onPointerUp() { dragging.current = false; }

  // Pinch-to-zoom on touch
  const lastDist = useRef<number | null>(null);
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    if (lastDist.current !== null) {
      const delta = dist - lastDist.current;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta * 0.01)));
    }
    lastDist.current = dist;
  }
  function onTouchEnd() { lastDist.current = null; }

  // Wheel zoom
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.002)));
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError("");

    // Render at output size
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext("2d");
    if (!ctx || !imgEl.current) { setSaving(false); return; }

    const img = imgEl.current;
    const previewSize = canvas.width;
    const scale = (previewSize / Math.min(img.naturalWidth, img.naturalHeight)) * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const x = (previewSize - drawW) / 2 + offset.x;
    const y = (previewSize - drawH) / 2 + offset.y;

    // Scale factor from preview canvas to output
    const ratio = OUTPUT_SIZE / previewSize;

    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x * ratio, y * ratio, drawW * ratio, drawH * ratio);
    ctx.restore();

    const dataUrl = out.toDataURL("image/jpeg", 0.82);

    try {
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Upload failed."); return; }
      onSaved(dataUrl);
      onClose();
    } catch {
      setError("Network error, please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-surface border border-border rounded-[--radius-lg] shadow-2xl w-full max-w-sm flex flex-col gap-5 p-6">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded hover:bg-surface-raised text-foreground-muted hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>

        <h2 className="text-base font-bold text-foreground">Update profile picture</h2>

        {!imageSrc ? (
          /* ── Drop / pick zone ── */
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-[--radius] py-12 text-foreground-muted hover:border-brand/50 hover:text-foreground transition-colors cursor-pointer"
          >
            <Upload size={28} className="opacity-60" />
            <span className="text-sm">Click to choose a photo</span>
            <span className="text-xs opacity-50">JPG, PNG, WebP, GIF</span>
          </button>
        ) : (
          /* ── Crop canvas ── */
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-foreground-muted text-center">Drag to reposition · scroll or pinch to zoom</p>
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onWheel={onWheel}
              className="rounded-full cursor-grab active:cursor-grabbing touch-none"
              style={{ width: 280, height: 280 }}
            />

            {/* Zoom slider */}
            <div className="flex items-center gap-2 w-full">
              <button onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.2))} className="text-foreground-muted hover:text-foreground">
                <ZoomOut size={15} />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--brand)]"
              />
              <button onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.2))} className="text-foreground-muted hover:text-foreground">
                <ZoomIn size={15} />
              </button>
            </div>

            <button
              onClick={() => { setOffset({ x: 0, y: 0 }); setZoom(1); }}
              className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-2 justify-end">
          {imageSrc && (
            <Button variant="ghost" size="sm" onClick={() => { setImageSrc(null); imgEl.current = null; }}>
              Change photo
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          {imageSrc && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
