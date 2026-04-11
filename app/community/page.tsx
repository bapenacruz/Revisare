"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ChevronDown, ChevronUp, Users, ShieldCheck, HelpCircle, Sparkles } from "lucide-react";

const RULES = [
  {
    title: "Argue in good faith",
    desc: "Address your opponent's actual points. Strawmanning or deliberately misrepresenting arguments will be penalised by the AI judges.",
  },
  {
    title: "Stay on topic",
    desc: "Keep your turns relevant to the motion. Off-topic tangents waste both debaters' time and reduce your score.",
  },
  {
    title: "Respect your opponent",
    desc: "Personal attacks, slurs, or harassment are strictly prohibited. Argue the idea, not the person.",
  },
  {
    title: "No AI-generated submissions",
    desc: "You must write your own turns. Using AI to generate debate content is grounds for a permanent ban.",
  },
  {
    title: "One account per person",
    desc: "Creating multiple accounts to avoid bans, pad stats, or manipulate matchmaking is prohibited and results in a permanent ban of all accounts.",
  },
  {
    title: "Forfeit rules",
    desc: "Failing to submit your turn within the time limit counts as a forfeit. Your opponent wins. Plan your time accordingly.",
  },
  {
    title: "Ranked integrity",
    desc: "Match manipulation, deliberate losses, or any form of ELO farming will result in an account reset and review.",
  },
];

const FAQ = [
  {
    q: "How does the AI judging work?",
    a: "Debates are evaluated by a three-model panel: Grok and Claude independently assess both sides across argumentation quality, evidence, logic, and rebuttal. A GPT Arbiter then reads both verdicts, re-evaluates the full debate, and delivers the final ruling with a detailed breakdown.",
  },
  {
    q: "What is ELO and how does it change?",
    a: "ELO is a skill rating system. Ranked wins increase it, losses decrease it. The exact change depends on the ELO difference between you and your opponent — beating a higher-ranked player earns more, losing to a lower-ranked player costs more.",
  },
  {
    q: "Can I spectate debates?",
    a: "Yes. All public debates can be watched in real time from the Explore page. You can also cast an audience vote — though this does not affect the official AI verdict.",
  },
  {
    q: "What is a Quick Duel vs Standard format?",
    a: "Quick Duel is Opening + Rebuttal per side (~10 min total). Standard adds a Closing argument (~20 min total). Both are available for ranked and casual play.",
  },
  {
    q: "How do I change my username?",
    a: "Usernames can only be changed once per year. Go to Profile → Edit Profile to update it.",
  },
  {
    q: "Can I delete my account?",
    a: "Account deletion is not yet self-serve. Contact support and your data will be removed within 30 days.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground hover:text-brand transition-colors"
      >
        {q}
        {open ? <ChevronUp size={15} className="shrink-0 text-foreground-muted" /> : <ChevronDown size={15} className="shrink-0 text-foreground-muted" />}
      </button>
      {open && (
        <p className="pb-4 text-sm text-foreground-muted leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const { data: session } = useSession();
  const user = session?.user as { username?: string; email?: string; elo?: number; wins?: number; losses?: number } | null | undefined;
  const [assessment, setAssessment] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.aiAssessment) setAssessment(data.user.aiAssessment);
      })
      .catch(() => {});
  }, [user?.username]);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Community</h1>

      {/* Profile card — shown only if logged in */}
      {user?.username && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">👤</span>
            <h2 className="text-lg font-bold text-foreground">Profile</h2>
          </div>
          <Card className="mb-6">
          <CardBody className="flex items-center gap-4 p-5">
            <Link href="/profile" className="hover:opacity-80 transition-opacity shrink-0">
              <Avatar initial={user.username[0].toUpperCase()} size="lg" />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href="/profile" className="font-bold text-foreground truncate hover:text-brand transition-colors block">{user.username}</Link>
              {user.email && <p className="text-xs text-foreground-subtle truncate">{user.email}</p>}
              <div className="flex items-center gap-2 mt-2">
                {typeof user.elo === "number" && (
                  <Badge variant="brand" size="sm">{user.elo} ELO</Badge>
                )}
                {typeof user.wins === "number" && (
                  <span className="text-xs text-foreground-subtle">{user.wins}W · {user.losses}L</span>
                )}
              </div>
            </div>
            <Link
              href="/profile"
              className="text-xs text-brand hover:text-brand-hover transition-colors shrink-0"
            >
              Edit/View →
            </Link>
          </CardBody>
        </Card>
        {assessment && (
          <Card className="mb-6">
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-brand shrink-0" />
                <p className="text-xs font-semibold text-foreground">Assessment</p>
              </div>
              <p className="text-sm text-foreground-muted leading-relaxed whitespace-pre-line">
                {(() => {
                  try {
                    const p = JSON.parse(assessment) as { text?: unknown };
                    if (typeof p.text === "string") return p.text;
                  } catch { /* legacy plain text */ }
                  return assessment;
                })()}
              </p>
            </CardBody>
          </Card>
        )}
        </>
      )}

      {!user && (
        <Card className="mb-6">
          <CardBody className="flex items-center gap-3 p-5">
            <Users size={20} className="text-foreground-muted shrink-0" />
            <p className="text-sm text-foreground-muted flex-1">
              <Link href="/auth/login" className="text-brand hover:underline">Log in</Link> or{" "}
              <Link href="/auth/signup" className="text-brand hover:underline">sign up</Link> to join the community.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Rules & Integrity */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <ShieldCheck size={18} className="text-brand" />
          <h2 className="text-lg font-bold text-foreground">Rules &amp; Integrity</h2>
        </div>
        <Card>
          <CardBody className="p-0">
            {RULES.map((rule, i) => (
              <div key={rule.title} className="flex gap-4 px-5 py-4 border-b border-border last:border-0">
                <span className="text-sm font-bold text-brand shrink-0 w-5 pt-px">{i + 1}.</span>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">{rule.title}</p>
                  <p className="text-sm text-foreground-muted leading-relaxed">{rule.desc}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* FAQ */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <HelpCircle size={18} className="text-brand" />
          <h2 className="text-lg font-bold text-foreground">FAQ</h2>
        </div>
        <Card>
          <CardBody className="p-4">
            {FAQ.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
