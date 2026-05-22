"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, X, Send, CheckCircle2, Users, MessageSquare, BarChart3, Zap, Scale, Brain, Trophy, Eye, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

const VERSION = "0.1.0";
const SUPPORT_EMAIL = "bapenacruz@gmail.com";

const CATEGORIES_CONTACT = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Account Issue",
  "Billing",
  "Content / Moderation",
  "Other",
];

// ─── Contact Form ─────────────────────────────────────────────────────────────

function ContactForm() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ category: "", email: "", subject: "", message: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const MAX_SIZE = 5 * 1024 * 1024;
    const oversized = picked.filter((f) => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      setError(`File too large: ${oversized.map((f) => f.name).join(", ")} (max 5 MB each)`);
      e.target.value = "";
      return;
    }
    setError("");
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = "";
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) { setError("Please select a category."); return; }
    if (!form.email) { setError("Please enter your email address."); return; }
    if (!form.subject.trim()) { setError("Please enter a subject."); return; }
    if (!form.message.trim()) { setError("Please enter a message."); return; }
    setError("");
    setSending(true);

    const attachments = await Promise.all(
      files.map(async (f) => {
        const buf = await f.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let b64 = "";
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
        return { filename: f.name, content: btoa(b64) };
      })
    );

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, attachments }),
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
          We&apos;ll get back to you at <span className="font-medium text-foreground">{form.email}</span> usually within 1–2 business days.
        </p>
        <button className="mt-2 text-xs text-brand hover:text-brand/80 transition-colors"
          onClick={() => { setSent(false); setForm({ category: "", email: "", subject: "", message: "" }); setFiles([]); }}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-foreground-muted">
        Fill in the form below or email us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand font-medium hover:underline">{SUPPORT_EMAIL}</a>.
      </p>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Category <span className="text-danger">*</span></label>
        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground outline-none focus:border-brand transition-colors">
          <option value="">Select a category...</option>
          {CATEGORIES_CONTACT.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Email <span className="text-danger">*</span></label>
        <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="you@example.com"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm outline-none focus:border-brand transition-colors placeholder:text-foreground-muted" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Subject <span className="text-danger">*</span></label>
        <input type="text" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          placeholder="Brief summary of your message"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm outline-none focus:border-brand transition-colors placeholder:text-foreground-muted" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Message <span className="text-danger">*</span></label>
        <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="Describe your issue or feedback..." rows={5}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm outline-none focus:border-brand transition-colors resize-none placeholder:text-foreground-muted" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground">Attachments <span className="text-foreground-muted font-normal">(optional, up to 5)</span></label>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-border text-xs text-foreground">
                <Paperclip size={11} className="text-foreground-muted" />
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-foreground-muted hover:text-foreground"><X size={11} /></button>
              </div>
            ))}
          </div>
        )}
        {files.length < 5 && (
          <>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFile} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-foreground-muted hover:border-brand hover:text-brand transition-colors">
              <Paperclip size={13} /> Add attachment
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={sending}
        className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-60 transition-colors">
        {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} /> Send Message</>}
      </button>
    </form>
  );
}

// ─── Collapsible ──────────────────────────────────────────────────────────────

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-[--radius] overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-surface-raised transition-colors">
        {title}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={cn("text-foreground-muted shrink-0 transition-transform duration-200", open && "rotate-180")}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-2 border-t border-border">{children}</div>}
    </div>
  );
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

type Stats = {
  totalDebates: number;
  debatesToday: number;
  debatesThisMonth: number;
  debatesThisYear: number;
  totalUsers: number;
  rankedDebates: number;
  totalViews: number;
  totalComments: number;
  totalVotes: number;
  topCategories: { label: string; emoji: string; count: number }[];
};

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-[--radius-lg] bg-surface border border-border">
      <div className="flex items-center gap-2 text-foreground-muted">{icon}<span className="text-xs uppercase tracking-wide font-medium">{label}</span></div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function CategoryBar({ label, emoji, count, max }: { label: string; emoji: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-6 text-center shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm text-foreground truncate">{label}</span>
          <span className="text-xs text-foreground-muted ml-2 tabular-nums shrink-0">{count.toLocaleString()}</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "about",  label: "About" },
  { id: "team",   label: "Team" },
  { id: "legal",  label: "Legal" },
  { id: "how",    label: "How It Works" },
  { id: "stats",  label: "Stats" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState<TabId>("about");
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "stats" && !stats && !statsLoading) {
      setStatsLoading(true);
      fetch("/api/about/stats")
        .then((r) => r.json())
        .then((data: Stats) => setStats(data))
        .catch(() => {})
        .finally(() => setStatsLoading(false));
    }
  }, [activeTab, stats, statsLoading]);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 pb-24">
      <h1 className="text-2xl font-bold text-foreground mb-6">About</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 rounded-[--radius] bg-surface border border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-[calc(var(--radius)-2px)] text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: About ── */}
      {activeTab === "about" && (
        <div className="flex flex-col gap-3">
          <div className="p-5 rounded-[--radius-lg] bg-surface border border-border">
            <h2 className="text-base font-semibold text-foreground mb-3">About Revisare</h2>
            <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
              <p>
                Revisare is a structured debate platform where users challenge opponents on any topic,
                argue their case in timed formats, and receive verdicts from an AI judge panel.
              </p>
              <p>
                Debates are ranked, tracked, and publicly viewable. Build your reputation, climb the
                leaderboard, and let your arguments speak for themselves.
              </p>
              <p>
                Whether you&apos;re practicing rhetoric, exploring ideas, or competing for sport —
                Revisare gives debate a home.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-[--radius-lg] bg-surface border border-border">
            <h2 className="text-base font-semibold text-foreground mb-3">Our Purpose</h2>
            <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
              <p>
                We believe rigorous, respectful debate is one of the most powerful tools for arriving at truth.
                Revisare exists to give that process a dedicated home — structured, fair, and accessible to everyone.
              </p>
              <p>
                Our goal is to foster a community where arguments are judged on their merits, not on who shouts
                loudest. By combining human debate with impartial AI judging, we aim to elevate the quality of
                public discourse one exchange at a time.
              </p>
              <p>
                Whether you are a competitive debater, a curious thinker, or simply someone who wants to sharpen
                their reasoning — Revisare is built for you.
              </p>
              <p className="italic text-foreground-subtle text-xs">More details about our mission and values coming soon.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Team ── */}
      {activeTab === "team" && (
        <div className="flex flex-col gap-3">
          <div className="p-5 rounded-[--radius-lg] bg-surface border border-border">
            <h2 className="text-base font-semibold text-foreground mb-3">Meet the Team</h2>
            <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
              <p>Revisare is built by a small team passionate about structured thinking, rhetoric, and AI.</p>
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-3 p-3 rounded-[--radius] bg-surface-raised border border-border">
                  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand text-base font-bold shrink-0">B</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Bapena Cruz</p>
                    <p className="text-xs text-foreground-muted">Founder &amp; Developer</p>
                  </div>
                </div>
                {/* Placeholder team members */}
                <div className="flex items-center gap-3 p-3 rounded-[--radius] bg-surface-raised border border-border opacity-40">
                  <div className="w-10 h-10 rounded-full bg-surface-raised border border-border flex items-center justify-center text-foreground-muted text-base font-bold shrink-0">?</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Your Name Here</p>
                    <p className="text-xs text-foreground-muted">Role — Coming Soon</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-foreground-subtle italic">We&apos;re a growing team. More members coming soon.</p>
            </div>
          </div>

          <div className="p-5 rounded-[--radius-lg] bg-surface border border-border">
            <h2 className="text-base font-semibold text-foreground mb-3">Contact Us</h2>
            <ContactForm />
          </div>
        </div>
      )}

      {/* ── Tab 3: Legal ── */}
      {activeTab === "legal" && (
        <div className="flex flex-col gap-3">
          <div className="p-4 rounded-[--radius-lg] bg-yellow-500/5 border border-yellow-500/20 text-xs text-foreground-muted leading-relaxed">
            <p className="font-semibold text-foreground mb-1">⚠️ Important Notice</p>
            <p>The documents below represent our current policies in summary form. Full legal documents are in preparation. By using Revisare, you agree to the terms described herein. Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Collapsible title="Terms of Service" defaultOpen>
              <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
                <p className="font-medium text-foreground">Acceptance of Terms</p>
                <p>By accessing or using Revisare (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.</p>

                <p className="font-medium text-foreground">Eligibility</p>
                <p>You must be at least 13 years of age (or the minimum age of digital consent in your jurisdiction) to use Revisare. By registering, you confirm that you meet this requirement.</p>

                <p className="font-medium text-foreground">Acceptable Use</p>
                <ul className="pl-5 list-disc flex flex-col gap-1">
                  <li>You agree to engage respectfully and in good faith during debates.</li>
                  <li>Hate speech, harassment, threats, and illegal content are strictly prohibited.</li>
                  <li>Attempting to manipulate, abuse, or exploit the AI judging system is prohibited.</li>
                  <li>You may not impersonate other users, public figures, or Revisare staff.</li>
                  <li>You may not use automated tools to post, vote, or interact on the Platform without express permission.</li>
                </ul>

                <p className="font-medium text-foreground">Content Ownership</p>
                <p>You retain ownership of your debate content. By submitting content, you grant Revisare a non-exclusive, royalty-free licence to display, store, and share that content as part of the Platform&apos;s normal operation. Debate transcripts are publicly visible by default.</p>

                <p className="font-medium text-foreground">Account Termination</p>
                <p>Revisare reserves the right to suspend or permanently ban accounts that violate these terms, without prior notice. You may delete your account at any time by contacting us.</p>

                <p className="font-medium text-foreground">Limitation of Liability</p>
                <p>The Platform is provided &ldquo;as is&rdquo;. Revisare is not liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>

                <p className="italic text-xs text-foreground-subtle">Full terms of service document coming soon.</p>
              </div>
            </Collapsible>

            <Collapsible title="Privacy Policy">
              <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
                <p className="font-medium text-foreground">Information We Collect</p>
                <ul className="pl-5 list-disc flex flex-col gap-1">
                  <li>Account information: email address, username, and hashed password.</li>
                  <li>Profile information you voluntarily provide: bio, country, social handles.</li>
                  <li>Debate activity: debate transcripts, votes, comments, and results.</li>
                  <li>Usage data: page views, session activity for platform analytics.</li>
                </ul>

                <p className="font-medium text-foreground">How We Use Your Information</p>
                <ul className="pl-5 list-disc flex flex-col gap-1">
                  <li>To operate and improve the Platform.</li>
                  <li>To display public debate profiles and leaderboards.</li>
                  <li>To send account-related notifications (e.g. debate results, challenges).</li>
                  <li>To enforce our Terms of Service.</li>
                </ul>

                <p className="font-medium text-foreground">Data Sharing</p>
                <p>We do not sell your personal data to third parties. Debate transcripts and results are public. We may share data with service providers (hosting, email) strictly for Platform operations.</p>

                <p className="font-medium text-foreground">Data Retention &amp; Deletion</p>
                <p>You may request deletion of your account and associated personal data at any time by contacting us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">{SUPPORT_EMAIL}</a>. Anonymised debate transcripts may be retained for platform integrity.</p>

                <p className="font-medium text-foreground">Cookies</p>
                <p>We use session cookies strictly for authentication purposes. We do not use tracking or advertising cookies.</p>

                <p className="italic text-xs text-foreground-subtle">Full privacy policy document coming soon.</p>
              </div>
            </Collapsible>

            <Collapsible title="Disclaimer">
              <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
                <p className="font-medium text-foreground">AI Judgments</p>
                <p>Verdicts issued by the AI judge panel are generated by third-party AI models (Anthropic Claude, OpenAI ChatGPT, xAI Grok) and are provided for entertainment and educational purposes only. They do not constitute professional opinion, legal advice, or factual verification.</p>

                <p className="font-medium text-foreground">Debate Content</p>
                <p>Arguments and statements made during debates represent the views of the individual users, not Revisare. The Platform does not endorse any opinion expressed in a debate.</p>

                <p className="font-medium text-foreground">No Professional Advice</p>
                <p>Nothing on this Platform constitutes legal, medical, financial, or other professional advice. Always seek qualified professional guidance for important decisions.</p>

                <p className="font-medium text-foreground">Accuracy</p>
                <p>Revisare does not verify the factual accuracy of claims made by users in debates. While AI judges may flag unsupported claims, this is not a guarantee of accuracy.</p>

                <p className="font-medium text-foreground">Platform Availability</p>
                <p>Revisare is provided on a best-effort basis. We do not guarantee uninterrupted availability and are not liable for any loss arising from downtime or service interruptions.</p>
              </div>
            </Collapsible>

            <Collapsible title="Cookie Policy">
              <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
                <p>Revisare uses a minimal number of cookies strictly necessary for the Platform to function:</p>
                <ul className="pl-5 list-disc flex flex-col gap-1">
                  <li><span className="text-foreground font-medium">Session cookie</span> — keeps you logged in during your browser session. Expires when you close your browser or log out.</li>
                  <li><span className="text-foreground font-medium">CSRF token</span> — protects form submissions against cross-site request forgery attacks.</li>
                </ul>
                <p>We do not use advertising, tracking, or analytics cookies. No third-party cookies are set by the Platform.</p>
              </div>
            </Collapsible>

            <Collapsible title="Contact for Legal Requests">
              <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
                <p>For legal inquiries, DMCA notices, data deletion requests, or privacy concerns, please contact us at:</p>
                <p><a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand font-medium hover:underline">{SUPPORT_EMAIL}</a></p>
                <p>We aim to respond to legal requests within 5 business days.</p>
              </div>
            </Collapsible>
          </div>
        </div>
      )}

      {/* ── Tab 4: How It Works ── */}
      {activeTab === "how" && (
        <div className="flex flex-col gap-3">
          <div className="p-5 rounded-[--radius-lg] bg-surface border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Scale size={18} className="text-brand" />
              <h2 className="text-base font-semibold text-foreground">Debate Format</h2>
            </div>
            <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
              <p>Each debate follows a structured format with timed rounds:</p>
              <ol className="flex flex-col gap-2 pl-5 list-decimal">
                <li><span className="text-foreground font-medium">Challenge</span> — One user challenges another on a specific motion. The opponent accepts or declines.</li>
                <li><span className="text-foreground font-medium">Opening Statements</span> <span className="text-foreground-subtle text-xs">(3 min)</span> — Each side states their position.</li>
                <li><span className="text-foreground font-medium">Rebuttals</span> <span className="text-foreground-subtle text-xs">(2 min)</span> — Each side challenges the other&apos;s arguments.</li>
                <li><span className="text-foreground font-medium">Crossfire</span> <span className="text-foreground-subtle text-xs">(90 sec/message)</span> — Direct back-and-forth exchange.</li>
                <li><span className="text-foreground font-medium">Closing Statements</span> <span className="text-foreground-subtle text-xs">(2 min)</span> — Each side makes their final case.</li>
              </ol>
              <p>Audience members can watch live, vote for who they think is winning or has won, and leave comments.</p>
            </div>
          </div>

          <div className="p-5 rounded-[--radius-lg] bg-surface border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={18} className="text-brand" />
              <h2 className="text-base font-semibold text-foreground">Emoji Guide</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                { emoji: "🏆", label: "AI Winner", desc: "Debater chosen as winner by the AI judge panel" },
                { emoji: "🥇", label: "Audience Pick", desc: "Debater with the most audience votes" },
                { emoji: "📊", label: "Ranked", desc: "This debate affects both players' ELO ratings" },
                { emoji: "👁️", label: "Spectators", desc: "Number of people who watched this debate" },
                { emoji: "💬", label: "Comments", desc: "Audience comments left on the debate" },
                { emoji: "⚖️", label: "Judged", desc: "Debate has received an AI verdict" },
              ].map(({ emoji, label, desc }) => (
                <div key={label} className="flex items-start gap-2.5 p-2.5 rounded-[--radius] bg-surface-raised border border-border">
                  <span className="text-lg shrink-0 leading-none mt-0.5">{emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-foreground-muted">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-[--radius-lg] bg-surface border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={18} className="text-brand" />
              <h2 className="text-base font-semibold text-foreground">AI Judge Panel</h2>
            </div>
            <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed">
              <p>After a debate ends, our AI judge panel independently evaluates each transcript and delivers a verdict. Each judge scores on:</p>
              <ul className="flex flex-col gap-1.5 pl-5 list-disc">
                <li><span className="text-foreground font-medium">Argument quality</span> — logic, structure, and clarity</li>
                <li><span className="text-foreground font-medium">Evidence &amp; fact-checking</span> — factual accuracy, cited sources, and verifiable claims</li>
                <li><span className="text-foreground font-medium">Rebuttals</span> — effectiveness of counter-arguments</li>
                <li><span className="text-foreground font-medium">Overall persuasiveness</span></li>
              </ul>
              <div className="p-3 rounded-[--radius] bg-surface-raised border border-border text-xs flex flex-col gap-2">
                <p className="font-semibold text-foreground">Evidence-based vs. Opinion-based debates</p>
                <p>When a debate involves factual claims (science, history, statistics), judges weigh <span className="text-foreground font-medium">accuracy and sourcing</span> heavily — unsupported claims are penalised. For opinion or values-based debates (ethics, policy, philosophy), judges focus more on <span className="text-foreground font-medium">internal consistency, logic, and persuasiveness</span> rather than demanding citations.</p>
              </div>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { name: "Claude", by: "Anthropic", color: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400" },
                  { name: "ChatGPT", by: "OpenAI", color: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400" },
                  { name: "Grok", by: "xAI", color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400" },
                ].map(({ name, by, color }) => (
                  <div key={name} className={cn("flex flex-col items-center gap-0.5 p-3 rounded-[--radius] border", color)}>
                    <p className="font-semibold text-sm">{name}</p>
                    <p className="text-xs opacity-70">by {by}</p>
                  </div>
                ))}
              </div>
              <p>The majority verdict determines the winner. All judge reasoning is displayed publicly on the results page.</p>
            </div>
          </div>

          <Collapsible title="Ranking System (ELO)" defaultOpen>
            <div className="flex flex-col gap-3 text-sm text-foreground-muted leading-relaxed mt-1">
              <p>Your ELO rating reflects how strong a debater you are compared to others. All players start at <span className="font-medium text-foreground">1000</span>.</p>
              <ul className="flex flex-col gap-1 pl-5 list-disc">
                <li>Win a debate to raise your rating</li>
                <li>Beat a stronger opponent to gain more points</li>
                <li>Lose to a weaker opponent to lose more points</li>
                <li>Unranked debates do not affect your rating</li>
              </ul>
              <div className="p-3 rounded-[--radius] bg-brand/10 border border-brand/20 text-xs">
                <span className="font-semibold text-brand">Tip:</span> Challenging stronger opponents is the fastest way to climb.
              </div>
            </div>
          </Collapsible>
        </div>
      )}

      {/* ── Tab 5: Stats ── */}
      {activeTab === "stats" && (
        <div className="flex flex-col gap-4">
          {statsLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 rounded-[--radius-lg] bg-surface animate-pulse border border-border" />
              ))}
            </div>
          )}

          {stats && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Completed Debates" value={stats.totalDebates} icon={<MessageSquare size={14} />} />
                <StatCard label="Completed Today" value={stats.debatesToday} icon={<Zap size={14} />} />
                <StatCard label="This Month" value={stats.debatesThisMonth} icon={<BarChart3 size={14} />} />
                <StatCard label="This Year" value={stats.debatesThisYear} icon={<BarChart3 size={14} />} />
                <StatCard label="Members" value={stats.totalUsers} icon={<Users size={14} />} />
                <StatCard label="Ranked Debates" value={stats.rankedDebates} icon={<Trophy size={14} />} />
                <StatCard label="Total Views" value={stats.totalViews} icon={<Eye size={14} />} />
                <StatCard label="Audience Votes" value={stats.totalVotes} icon={<ThumbsUp size={14} />} />
                <StatCard label="Comments" value={stats.totalComments} icon={<MessageSquare size={14} />} />
              </div>

              {stats.topCategories.length > 0 && (
                <div className="p-5 rounded-[--radius-lg] bg-surface border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Popular Categories</h3>
                  <div className="flex flex-col gap-3">
                    {stats.topCategories.map((c) => (
                      <CategoryBar
                        key={c.label}
                        label={c.label}
                        emoji={c.emoji}
                        count={c.count}
                        max={stats.topCategories[0]?.count ?? 1}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-10 flex flex-col gap-1 text-xs text-foreground-subtle text-center">
        <p>© {new Date().getFullYear()} Revisare. All rights reserved.</p>
        <p>Version {VERSION}</p>
      </div>
    </div>
  );
}