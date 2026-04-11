"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Input, TextArea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { CountryRegionPicker } from "@/components/ui/CountryRegionPicker";

interface EditProfileFormProps {
  initial: {
    username: string;
    bio?: string | null;
    country?: string | null;
    region?: string | null;
    dob?: Date | string | null;
    gender?: string | null;
    twitterHandle?: string | null;
    threadsHandle?: string | null;
    truthSocialHandle?: string | null;
    blueskyHandle?: string | null;
    mastodonHandle?: string | null;
    websiteUrl?: string | null;
    lastUsernameChange?: Date | string | null;
    favCategories: Array<{ category: { id: string; slug: string; label: string; emoji: string } }>;
  };
  allCategories: Array<{ id: string; slug: string; label: string; emoji: string }>;
}

export function EditProfileForm({ initial, allCategories }: EditProfileFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    username: initial.username,
    bio: initial.bio ?? "",
    country: initial.country ?? "",
    region: initial.region ?? "",
    dob: initial.dob ? new Date(initial.dob).toISOString().split("T")[0] : "",
    gender: initial.gender ?? "",
    twitterHandle: initial.twitterHandle ?? "",
    threadsHandle: initial.threadsHandle ?? "",
    truthSocialHandle: initial.truthSocialHandle ?? "",
    blueskyHandle: initial.blueskyHandle ?? "",
    mastodonHandle: initial.mastodonHandle ?? "",
    websiteUrl: initial.websiteUrl ?? "",
  });
  const [selectedCats, setSelectedCats] = useState<string[]>(
    initial.favCategories.map((fc) => fc.category.id)
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleting, setDeleting] = useState(false);

  const canChangeUsername = !initial.lastUsernameChange ||
    Date.now() - new Date(initial.lastUsernameChange).getTime() >= 365 * 24 * 60 * 60 * 1000;

  const toggleCategory = (id: string) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, favCategoryIds: selectedCats }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(data.error ?? "Failed to save.");
    } else {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    await fetch("/api/profile", { method: "DELETE" });
    await signOut({ redirect: false });
    router.push("/");
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <Input
        label="Username"
        value={form.username}
        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
        disabled={!canChangeUsername}
        hint={
          canChangeUsername
            ? "Usernames can only be changed once per year."
            : `Username locked. Next change available in 12 months.`
        }
      />
      <TextArea
        label="Bio"
        value={form.bio}
        onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
        placeholder="Tell the community about yourself..."
        hint="Max 300 characters."
      />

      {/* Country + Region picker */}
      <CountryRegionPicker
        country={form.country}
        region={form.region}
        onCountryChange={(c) => setForm((f) => ({ ...f, country: c, region: "" }))}
        onRegionChange={(r) => setForm((f) => ({ ...f, region: r }))}
      />

      {/* Date of birth */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">Date of Birth</label>
        <input
          type="date"
          value={form.dob}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm outline-none focus:border-brand transition-colors"
        />
      </div>

      {/* Gender */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">
          Gender <span className="text-foreground-muted font-normal">(optional)</span>
        </label>
        <div className="flex gap-2">
          {(["male", "female", "nonbinary"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setForm((f) => ({ ...f, gender: f.gender === g ? "" : g }))}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors ${
                form.gender === g
                  ? "bg-brand text-white border-brand"
                  : "bg-transparent border-border text-foreground hover:border-brand/60"
              }`}
            >
              {g === "nonbinary" ? "Non-binary" : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Twitter / X handle"
          value={form.twitterHandle}
          onChange={(e) => setForm((f) => ({ ...f, twitterHandle: e.target.value }))}
          placeholder="@handle"
        />
        <Input
          label="Threads handle"
          value={form.threadsHandle}
          onChange={(e) => setForm((f) => ({ ...f, threadsHandle: e.target.value }))}
          placeholder="@handle"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Truth Social handle"
          value={form.truthSocialHandle}
          onChange={(e) => setForm((f) => ({ ...f, truthSocialHandle: e.target.value }))}
          placeholder="@handle"
        />
        <Input
          label="Bluesky handle"
          value={form.blueskyHandle}
          onChange={(e) => setForm((f) => ({ ...f, blueskyHandle: e.target.value }))}
          placeholder="handle.bsky.social"
        />
      </div>
      <Input
        label="Mastodon handle"
        value={form.mastodonHandle}
        onChange={(e) => setForm((f) => ({ ...f, mastodonHandle: e.target.value }))}
        placeholder="@user@instance.social"
      />
      <Input
        label="Website"
        type="url"
        value={form.websiteUrl}
        onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
        placeholder="https://yoursite.com"
      />

      {/* Favorite categories */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Favorite Categories{" "}
          <span className="text-foreground-muted font-normal">(up to 5)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((cat) => {
            const selected = selectedCats.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selected
                    ? "bg-brand-dim border-brand text-brand"
                    : "bg-transparent border-border text-foreground-muted hover:border-brand/50"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status */}
      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <XCircle size={14} />
          {errorMsg}
        </div>
      )}
      {status === "saved" && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 size={14} />
          Profile saved!
        </div>
      )}

      <Button type="submit" isLoading={status === "saving"}>
        Save Profile
      </Button>

      {/* Danger zone */}
      <div className="border-t border-border pt-5 mt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Danger Zone</p>
        {deleteStep === "idle" && (
          <button
            type="button"
            onClick={() => setDeleteStep("confirm")}
            className="flex items-center gap-2 text-sm text-danger hover:text-danger/80 transition-colors"
          >
            <Trash2 size={14} />
            Delete Account
          </button>
        )}
        {deleteStep === "confirm" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground-muted">
              This will permanently delete your account and all your data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteStep("idle")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-danger hover:bg-danger/80 text-white border-danger"
                isLoading={deleting}
                onClick={handleDeleteAccount}
              >
                Yes, delete my account
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
