export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Megaphone, ExternalLink, Trophy } from "lucide-react";
import { db } from "@/lib/db";

const ROUND_LABEL: Record<string, string> = {
  opening: "Opening Statement",
  crossfire: "Crossfire",
  rebuttal: "Rebuttal",
  summary: "Summary",
  closing: "Closing Statement",
};

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const ad = await db.ad.findUnique({ where: { id, isActive: true, isDeleted: false }, select: { motion: true, businessName: true } });
  if (!ad) return { title: "Not Found" };
  return { title: `${ad.motion} — ${ad.businessName ?? "Sponsored"}` };
}

export default async function AdDebatePage({ params }: Props) {
  const { id } = await params;

  const ad = await db.ad.findUnique({
    where: { id, isActive: true, isDeleted: false },
    select: {
      id: true,
      motion: true,
      businessName: true,
      proponentName: true,
      opponentName: true,
      officialResult: true,
      linkUrl: true,
      turns: {
        orderBy: { order: "asc" },
        select: { id: true, speaker: true, roundName: true, content: true },
      },
    },
  });

  if (!ad) notFound();

  // Group turns by round
  const rounds = ad.turns.reduce<Map<string, { proponent?: string; opponent?: string }>>(
    (acc, turn) => {
      if (!acc.has(turn.roundName)) acc.set(turn.roundName, {});
      const entry = acc.get(turn.roundName)!;
      if (turn.speaker === "proponent") entry.proponent = turn.content;
      else entry.opponent = turn.content;
      return acc;
    },
    new Map()
  );

  // Ordered round names present in this ad
  const roundOrder = ["opening", "crossfire", "rebuttal", "summary", "closing"];
  const orderedRounds = roundOrder.filter((r) => rounds.has(r));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide border bg-brand/10 text-brand border-brand/20">
              <Megaphone size={11} /> Sponsored
            </span>
            {ad.businessName && (
              <span className="text-sm text-foreground-muted">by {ad.businessName}</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug">{ad.motion}</h1>
        </div>

        {/* Official Result */}
        <div className="rounded-[--radius-lg] border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-yellow-500 shrink-0" />
            <h2 className="text-base font-semibold text-foreground">Official Result</h2>
          </div>
          <p className="text-sm text-foreground">
            <span className="font-semibold">{ad.proponentName}</span> wins this debate.
          </p>
          {ad.officialResult && (
            <p className="text-sm text-foreground-muted leading-relaxed border-t border-border pt-3">
              {ad.officialResult}
            </p>
          )}
        </div>

        {/* Participants */}
        <div className="flex gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-2 px-3 py-2 rounded-[--radius] border border-border bg-surface">
            <Trophy size={14} className="text-yellow-500" />
            <span className="font-semibold text-foreground">{ad.proponentName}</span>
            <span className="text-foreground-muted text-xs">Proponent</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-[--radius] border border-border bg-surface">
            <span className="w-3.5 h-3.5 rounded-full border border-border bg-surface-overlay inline-block" />
            <span className="text-foreground-muted">{ad.opponentName}</span>
            <span className="text-foreground-muted text-xs">Opponent</span>
          </div>
        </div>

        {/* Full Transcript */}
        {orderedRounds.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">Full Transcript</h2>
            {orderedRounds.map((roundName) => {
              const round = rounds.get(roundName)!;
              return (
                <div key={roundName} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                    {ROUND_LABEL[roundName] ?? roundName}
                  </h3>
                  {round.proponent && (
                    <div className="rounded-[--radius] border border-border bg-surface p-4 space-y-1.5">
                      <p className="text-xs font-semibold text-brand">{ad.proponentName}</p>
                      <p className="text-sm text-foreground leading-relaxed">{round.proponent}</p>
                    </div>
                  )}
                  {round.opponent && (
                    <div className="rounded-[--radius] border border-border bg-surface-raised p-4 space-y-1.5">
                      <p className="text-xs font-semibold text-foreground-muted">{ad.opponentName}</p>
                      <p className="text-sm text-foreground leading-relaxed">{round.opponent}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-4 border-t border-border flex items-center justify-between">
          <Link href="/debates" className="text-sm text-foreground-muted hover:text-foreground transition-colors">
            ← Back to debates
          </Link>
          {ad.linkUrl && (
            <a
              href={ad.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[--radius] bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
            >
              <ExternalLink size={14} />
              {ad.businessName ? `Visit ${ad.businessName}` : "Visit Website"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
