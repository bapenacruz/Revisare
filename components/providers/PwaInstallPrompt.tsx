"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/providers/SessionProvider";

const STORAGE_KEY_DISMISSED = "pwa_prompt_dismissed_forever";
const STORAGE_KEY_LAST_SHOWN = "pwa_prompt_last_shown";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isPwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function PwaInstallPrompt() {
  const { status } = useSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Never show inside the PWA itself
    if (isPwa()) return;
    // Opt-out check
    if (localStorage.getItem(STORAGE_KEY_DISMISSED) === "1") return;
    // Weekly cadence
    const last = Number(localStorage.getItem(STORAGE_KEY_LAST_SHOWN) ?? "0");
    if (Date.now() - last < ONE_WEEK_MS) return;
    // Small delay so the page settles first
    const id = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(id);
  }, [status]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY_LAST_SHOWN, String(Date.now()));
    setVisible(false);
  }

  function dismissForever() {
    localStorage.setItem(STORAGE_KEY_DISMISSED, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "4.5rem",
        left: "1rem",
        right: "1rem",
        zIndex: 9998,
        background: "var(--color-surface, #1a1a2e)",
        border: "1px solid var(--color-border, #2a2a3e)",
        borderRadius: "0.75rem",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <Smartphone size={20} style={{ flexShrink: 0, opacity: 0.7, marginTop: "0.1rem" }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.3 }}>
            Install Revisare
          </p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", opacity: 0.7, lineHeight: 1.4 }}>
            Add Revisare to your home screen for a faster, app-like experience — no App Store needed.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.5,
            padding: "0.1rem",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          onClick={dismissForever}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.75rem",
            opacity: 0.55,
            padding: "0.3rem 0.2rem",
          }}
        >
          Don&apos;t show again
        </button>
        <Link
          href="/account"
          onClick={dismiss}
          style={{
            background: "var(--color-primary, #6366f1)",
            color: "#fff",
            borderRadius: "0.5rem",
            padding: "0.4rem 0.85rem",
            fontSize: "0.8rem",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Show me how
        </Link>
      </div>
    </div>
  );
}
