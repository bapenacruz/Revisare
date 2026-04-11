"use client";

import { useState, useRef } from "react";
import { ChevronDown, Paperclip, X, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VERSION = "0.1.0";

const SUPPORT_EMAIL = "bapenacruz@gmail.com";

const CATEGORIES = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Account Issue",
  "Billing",
  "Content / Moderation",
  "Other",
];

function ContactForm() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ category: "", email: "", subject: "", message: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const oversized = picked.filter((f) => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      setError(`File too large: ${oversized.map((f) => f.name).join(", ")} (max 5 MB each)`);
      e.target.value = "";
      return;
    }
    setError("");
    setFiles((prev) => {
      const combined = [...prev, ...picked];
      return combined.slice(0, 5); // max 5 attachments
    });
    e.target.value = "";
  };

  const removeFile = (i: number) =>
    setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) { setError("Please select a category."); return; }
    if (!form.email) { setError("Please enter your email address."); return; }
    if (!form.subject.trim()) { setError("Please enter a subject."); return; }
    if (!form.message.trim()) { setError("Please enter a message."); return; }
    setError("");
    setSending(true);

    // Convert files to base64 for JSON transport
    const attachments = await Promise.all(
      files.map(async (f) => {
        const buf = await f.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let b64 = "";
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
          b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return { filename: f.name, content: btoa(b64) };
      })
    );

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: form.category, email: form.email, subject: form.subject, message: form.message, attachments }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to send. Please try again.");
        setSending(false);
        return;
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSending(false);
      return;
    }

    setSending(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 size={40} className="text-success" />
        <p className="text-sm font-semibold text-foreground">Message received — thank you!</p>
        <p className="text-xs text-foreground-muted max-w-xs">
          We'll get back to you at <span className="font-medium text-foreground">{form.email}</span>{" "}
          as soon as possible, usually within 1–2 business days.
        </p>
        <button
          className="mt-2 text-xs text-brand hover:text-brand/80 transition-colors"
          onClick={() => { setSent(false); setForm({ category: "", email: "", subject: "", message: "" }); setFiles([]); }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-foreground-muted">
        Fill in the form below or email us directly at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand font-medium hover:underline">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Category <span className="text-danger">*</span></label>
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground outline-none focus:border-brand transition-colors"
        >
          <option value="">Select a category...</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Contact email */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Email <span className="text-danger">*</span></label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="you@example.com"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm outline-none focus:border-brand transition-colors placeholder:text-foreground-muted"
        />
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Subject <span className="text-danger">*</span></label>
        <input
          type="text"
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          placeholder="Brief summary of your message"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm outline-none focus:border-brand transition-colors placeholder:text-foreground-muted"
        />
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Message <span className="text-danger">*</span></label>
        <textarea
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="Describe your issue or feedback..."
          rows={5}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm outline-none focus:border-brand transition-colors resize-none placeholder:text-foreground-muted"
        />
      </div>

      {/* Attachments */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground">
          Attachments{" "}
          <span className="text-foreground-muted font-normal">(optional, up to 5)</span>
        </label>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-border text-xs text-foreground"
              >
                <Paperclip size={11} className="text-foreground-muted" />
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-foreground-muted hover:text-foreground"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        {files.length < 5 && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-foreground-muted hover:border-brand hover:text-brand transition-colors"
            >
              <Paperclip size={13} />
              Add attachment
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-60 transition-colors"
      >
        {sending ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Send size={14} />
            Send Message
          </>
        )}
      </button>
    </form>
  );
}

const SECTIONS = [
  {
    id: "about",
    title: "About Revisare",
    content: (
      <div className="flex flex-col gap-4 text-sm text-foreground-muted leading-relaxed">
        <p>
          Revisare is a structured debate platform where users challenge opponents on any topic,
          argue their case in timed formats, and receive verdicts from an AI judge panel.
        </p>
        <p>
          Debates are ranked, tracked, and publicly viewable. Build your reputation, climb the
          leaderboard, and let your arguments speak for themselves.
        </p>
        <p>
          Whether you&apos;re practicing rhetoric, exploring ideas, or competing for sport — Revisare
          gives debate a home.
        </p>

        <div className="flex flex-col gap-2 mt-1">
          <SubAccordionItem title="Ranking System">
            <div className="flex flex-col gap-4 text-sm text-foreground-muted leading-relaxed mt-2">

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">The Goal</p>
                <p>Your rating reflects how strong of a debater you are compared to others.</p>
                <ul className="mt-1 flex flex-col gap-1 pl-4 list-disc">
                  <li>Win debates → rating goes up</li>
                  <li>Lose debates → rating goes down</li>
                  <li>Tie → small adjustment based on opponent strength</li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Starting Rating</p>
                <ul className="flex flex-col gap-1 pl-4 list-disc">
                  <li>All players start at <span className="font-medium text-foreground">1000</span></li>
                  <li>Your rating updates after every ranked debate</li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">How Points Work</p>
                <p>Your rating change depends on your rating, your opponent&apos;s rating, and the result.</p>
                <ul className="mt-1 flex flex-col gap-1 pl-4 list-disc">
                  <li>Beat a stronger opponent → gain more points</li>
                  <li>Beat a weaker opponent → gain fewer points</li>
                  <li>Lose to a stronger opponent → lose fewer points</li>
                  <li>Lose to a weaker opponent → lose more points</li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Examples</p>
                <ul className="flex flex-col gap-1 pl-4 list-disc">
                  <li>You (1000) beat a 1400 → big increase</li>
                  <li>You (1400) beat a 1000 → small increase</li>
                  <li>You (1000) lose to 1400 → small decrease</li>
                  <li>You (1400) lose to 1000 → big decrease</li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Early Matches</p>
                <p>Your first few ranked debates adjust your rating faster to quickly place you at your skill level.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Ties</p>
                <ul className="flex flex-col gap-1 pl-4 list-disc">
                  <li>Ties give a small adjustment</li>
                  <li>Tying a stronger opponent → you gain points</li>
                  <li>Tying a weaker opponent → you lose points</li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Unranked Debates</p>
                <ul className="flex flex-col gap-1 pl-4 list-disc">
                  <li>Do not affect your rating</li>
                  <li>Use them for practice or casual debates</li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">What Your Rating Means</p>
                <ul className="flex flex-col gap-1 pl-4 list-disc">
                  <li>Around 1000 → average</li>
                  <li>Higher rating → stronger debater</li>
                  <li>Lower rating → still improving</li>
                </ul>
                <p className="mt-1">Your rating is always relative to other players.</p>
              </div>

              <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-brand/10 border border-brand/20">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">Important</p>
                <ul className="flex flex-col gap-1 pl-4 list-disc">
                  <li>Challenging stronger opponents is the fastest way to climb</li>
                  <li>Beating weaker opponents won&apos;t increase your rating much</li>
                  <li>Consistency matters more than streaks</li>
                </ul>
              </div>

            </div>
          </SubAccordionItem>

          <SubAccordionItem title="FAQ">
            <div className="flex flex-col gap-4 text-sm text-foreground-muted leading-relaxed mt-2">

              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">What is a ranked debate?</p>
                <p>A ranked debate affects your rating. Both players must agree to ranked mode before the debate begins.</p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">Who judges debates?</p>
                <p>An AI judge panel evaluates each debate based on argument quality, evidence, and delivery. Verdicts are automated and impartial.</p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">Can I challenge anyone?</p>
                <p>Yes. You can challenge any registered user. They must accept before the debate starts.</p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">How long does a debate take?</p>
                <p>It depends on the format. Most debates have timed rounds; total time is typically 10–30 minutes depending on the format chosen.</p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">Are debates public?</p>
                <p>Yes. All completed debates are publicly viewable. Anyone can read the transcript and verdict.</p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">Can I delete a debate?</p>
                <p>Debates are part of the public record and cannot be deleted. You can request account deletion to remove your association with all content.</p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">What happens if my opponent doesn&apos;t respond?</p>
                <p>If a participant goes inactive during a debate, the round may time out. The judge panel will evaluate based on what was submitted.</p>
              </div>

            </div>
          </SubAccordionItem>
        </div>
      </div>
    ),
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    content: (
      <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
        <p>
          We collect only the information necessary to operate the platform: your email address,
          username, and debate activity. We do not sell your data to third parties.
        </p>
        <p>
          Debate transcripts and results are public by default. You may request deletion of your
          account and associated data at any time by contacting us.
        </p>
        <p>
          <em>Full privacy policy coming soon.</em>
        </p>
      </div>
    ),
  },
  {
    id: "terms",
    title: "Terms of Service",
    content: (
      <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
        <p>
          By using Revisare you agree to engage respectfully. Hate speech, harassment, and abuse
          of the AI judging system are prohibited and may result in account suspension.
        </p>
        <p>
          Revisare reserves the right to remove content or accounts that violate these terms
          without prior notice.
        </p>
        <p>
          <em>Full terms of service coming soon.</em>
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: <ContactForm />,
  },
];

function SubAccordionItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left text-foreground font-medium text-sm hover:bg-surface-raised transition-colors"
      >
        {title}
        <ChevronDown
          size={14}
          className={cn(
            "text-foreground-muted shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="px-3 pb-4 pt-1 border-t border-border">{children}</div>}
    </div>
  );
}

function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-left text-foreground font-medium text-sm hover:text-brand transition-colors"
      >
        {title}
        <ChevronDown
          size={16}
          className={cn(
            "text-foreground-muted shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="pb-5">{children}</div>}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground mb-8">About</h1>

      <div className="bg-surface border border-border rounded-[--radius-lg] px-5">
        {SECTIONS.map((s, i) => (
          <AccordionItem key={s.id} title={s.title} defaultOpen={i === 0}>
            {s.content}
          </AccordionItem>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-1 text-xs text-foreground-subtle text-center">
        <p>© {new Date().getFullYear()} Revisare. All rights reserved.</p>
        <p>Version {VERSION}</p>
      </div>
    </div>
  );
}
