"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { Sword, ChevronRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CountryRegionPicker } from "@/components/ui/CountryRegionPicker";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "nonbinary", label: "Non-binary" },
];

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill username from session once loaded
  useEffect(() => {
    if (session?.user?.username && !username) {
      setUsername(session.user.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.username]);

  // Debounced username availability check
  useEffect(() => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    if (!username) { setUsernameStatus("idle"); return; }
    const re = /^[a-z0-9_.]{3,20}$/;
    if (!re.test(username)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    checkTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/check-username?username=${encodeURIComponent(username)}`);
        const data = await res.json() as { available: boolean };
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => { if (checkTimerRef.current) clearTimeout(checkTimerRef.current); };
  }, [username]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    } else if (status === "authenticated" && session?.user?.onboardingComplete) {
      router.replace("/");
    }
  }, [status, session, router]);

  if (status === "loading" || status === "unauthenticated") return null;
  if (status === "authenticated" && session?.user?.onboardingComplete) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || usernameStatus !== "available") { setError("Please choose a valid, available username."); return; }
    if (!country) { setError("Please select your country."); return; }
    if (!dob) { setError("Please enter your date of birth."); return; }
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, country, region, dob, gender }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    // Push onboardingComplete:true into the JWT cookie so middleware unblocks
    await update({ onboardingComplete: true });
    // Hard navigation ensures middleware re-reads the freshly written cookie
    window.location.href = "/?welcome=1";
  };

  // Max date for DOB: today - 18 years
  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split("T")[0];
  })();

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <Sword size={16} className="text-white" />
            </div>
            <span className="font-bold text-foreground text-sm">Revisare</span>
          </div>
          <span className="text-xs text-foreground-muted">Step 1 of 1</span>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center px-4 py-8">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold text-foreground mb-1">Welcome to Revisare</h1>
            <p className="text-sm text-foreground-muted mb-6">
              Tell us a bit about yourself to get started. Country and date of birth are required.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Username */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Username <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                    placeholder="your_handle"
                    maxLength={20}
                    required
                    className={`w-full px-3 py-2.5 pr-9 rounded-lg border text-sm outline-none transition-colors bg-surface ${
                      usernameStatus === "available" ? "border-emerald-500 focus:border-emerald-500" :
                      usernameStatus === "taken" || usernameStatus === "invalid" ? "border-danger focus:border-danger" :
                      "border-border focus:border-brand"
                    }`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    {usernameStatus === "checking" && <span className="text-xs text-foreground-muted animate-pulse">…</span>}
                    {usernameStatus === "available" && <Check size={14} className="text-emerald-500" />}
                    {(usernameStatus === "taken" || usernameStatus === "invalid") && <X size={14} className="text-danger" />}
                  </div>
                </div>
                <p className={`text-xs ${
                  usernameStatus === "taken" ? "text-danger" :
                  usernameStatus === "invalid" ? "text-danger" :
                  usernameStatus === "available" ? "text-emerald-500" :
                  "text-foreground-muted"
                }`}>
                  {usernameStatus === "taken" ? "Username already taken." :
                   usernameStatus === "invalid" ? "3–20 chars, lowercase letters, numbers, underscores only." :
                   usernameStatus === "available" ? "Username available!" :
                   "3–20 chars, lowercase letters, numbers, underscores only."}
                </p>
              </div>

              {/* Country + Region */}
              <CountryRegionPicker
                country={country}
                region={region}
                onCountryChange={(c) => { setCountry(c); setRegion(""); }}
                onRegionChange={setRegion}
                required
              />

              {/* Date of birth */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Date of Birth <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={dob}
                  max={maxDob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm outline-none focus:border-brand transition-colors"
                />
                <p className="text-xs text-foreground-muted">You must be at least 18 years old.</p>
              </div>

              {/* Gender (optional) */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Gender <span className="text-foreground-muted font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGender((g) => g === opt.value ? "" : opt.value)}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        gender === opt.value
                          ? "bg-brand text-white border-brand"
                          : "bg-transparent border-border text-foreground hover:border-brand/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={submitting}
              >
                <span className="flex items-center gap-2">
                  Complete Profile
                  <ChevronRight size={16} />
                </span>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
