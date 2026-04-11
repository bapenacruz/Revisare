"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeAndSave(): Promise<void> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
}

function isPwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function PushSetup() {
  const { status } = useSession();
  // "idle" | "prompt" | "done"
  const [uiState, setUiState] = useState<"idle" | "prompt" | "done">("idle");

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "granted") {
      // Already granted — subscribe silently (e.g. new device / cleared sub)
      subscribeAndSave().catch(() => undefined);
      setUiState("done");
      return;
    }
    if (Notification.permission === "denied") return;

    // iOS requires user gesture — show prompt banner instead of auto-requesting
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      // Only show in PWA mode on iOS; in browser tab push isn't supported anyway
      if (isPwa()) setUiState("prompt");
      return;
    }

    // Non-iOS: request immediately (Chrome/Android/desktop)
    Notification.requestPermission()
      .then((p) => { if (p === "granted") return subscribeAndSave(); })
      .catch(() => undefined)
      .finally(() => setUiState("done"));
  }, [status]);

  async function handleEnable() {
    setUiState("done");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") await subscribeAndSave();
    } catch {
      // silently ignore
    }
  }

  if (uiState !== "prompt") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "4.5rem",
        left: "1rem",
        right: "1rem",
        zIndex: 9999,
        background: "var(--color-surface, #1a1a2e)",
        border: "1px solid var(--color-border, #2a2a3e)",
        borderRadius: "0.75rem",
        padding: "0.875rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      <Bell size={20} style={{ flexShrink: 0, opacity: 0.7 }} />
      <p style={{ flex: 1, fontSize: "0.875rem", margin: 0, lineHeight: 1.4 }}>
        Enable notifications to get alerts for challenges and results.
      </p>
      <button
        onClick={handleEnable}
        style={{
          flexShrink: 0,
          background: "var(--color-primary, #6366f1)",
          color: "#fff",
          border: "none",
          borderRadius: "0.5rem",
          padding: "0.4rem 0.85rem",
          fontSize: "0.8rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Enable
      </button>
      <button
        onClick={() => setUiState("done")}
        style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 4, opacity: 0.5 }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

