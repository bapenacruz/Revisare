"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, Mail, FileText } from "lucide-react";

interface SiteSettings {
  supportEmail: string;
  contactMailtoBody: string;
}

const PLACEHOLDERS = ["[username]", "[country]", "[region]"];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>({ supportEmail: "", contactMailtoBody: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site-settings");
      if (res.ok) setSettings(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-1">Site Settings</h1>
      <p className="text-sm text-foreground-muted mb-8">Configure contact information shown across the site.</p>

      <div className="flex flex-col gap-6">
        {/* Support email */}
        <div className="rounded-[--radius] border border-border bg-surface p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-foreground-muted" />
            <h2 className="text-sm font-semibold text-foreground">Support Email</h2>
          </div>
          <p className="text-xs text-foreground-muted">
            This email appears in the About page contact section, Terms of Service, and Privacy Policy.
          </p>
          <input
            type="email"
            value={settings.supportEmail}
            onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
            placeholder="support@example.com"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-brand transition-colors placeholder:text-foreground-muted"
          />
        </div>

        {/* Mailto body */}
        <div className="rounded-[--radius] border border-border bg-surface p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-foreground-muted" />
            <h2 className="text-sm font-semibold text-foreground">Contact Mailto Body Template</h2>
          </div>
          <p className="text-xs text-foreground-muted">
            Pre-fills the email body when a user clicks a mailto link. The section below the "Do not modify" marker is
            auto-populated with the user&apos;s details so you can identify who sent the email. Use these placeholders:
          </p>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDERS.map((p) => (
              <code
                key={p}
                className="px-2 py-0.5 rounded bg-surface-raised border border-border text-xs text-brand font-mono cursor-pointer select-all"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(p)}
              >
                {p}
              </code>
            ))}
            <span className="text-xs text-foreground-muted self-center">(click to copy)</span>
          </div>
          <textarea
            value={settings.contactMailtoBody}
            onChange={(e) => setSettings((s) => ({ ...s, contactMailtoBody: e.target.value }))}
            rows={10}
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono outline-none focus:border-brand transition-colors resize-y"
          />
          <div className="rounded-[--radius] bg-yellow-500/5 border border-yellow-500/20 px-3 py-2.5">
            <p className="text-xs text-foreground-muted leading-relaxed">
              <span className="font-medium text-foreground">Preview — logged-in user:</span>{" "}
              Placeholders will be replaced with the actual user&apos;s username, country, and region at click-time.
              For guests, they appear as <span className="font-mono text-xs">Guest</span> / empty.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="self-start flex items-center gap-2 px-5 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check size={14} /> Saved</>
          ) : (
            "Save Settings"
          )}
        </button>
      </div>
    </div>
  );
}
