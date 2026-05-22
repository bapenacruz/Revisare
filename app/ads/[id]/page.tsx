import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ExternalLink, ArrowLeft } from "lucide-react";

export default async function AdDebatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ad = await db.ad.findFirst({
    where: { id, isDeleted: false },
    include: {
      turns: { orderBy: { order: "asc" } },
      category: true,
    },
  });

  if (!ad) notFound();

  const speakers: Record<string, string> = {
    proponent: ad.proponentName,
    opponent: ad.opponentName,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors mb-6">
        <ArrowLeft size={14} /> Back to feed
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-brand/10 text-brand border-brand/20">
            Sponsored
          </span>
          {ad.businessName && (
            <span className="text-xs text-foreground-muted">{ad.businessName}</span>
          )}
          {ad.category && (
            <span className="text-xs text-foreground-muted">
              {ad.category.emoji} {ad.category.label}
            </span>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug mb-4">
          {ad.motion}
        </h1>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-foreground-muted text-xs uppercase tracking-wide font-medium">For</span>
            <p className="font-semibold text-foreground">{ad.proponentName}</p>
          </div>
          <div className="text-foreground-muted">vs</div>
          <div>
            <span className="text-foreground-muted text-xs uppercase tracking-wide font-medium">Against</span>
            <p className="font-semibold text-foreground">{ad.opponentName}</p>
          </div>
        </div>
      </div>

      {/* Official result */}
      {ad.officialResult && (
        <div className="mb-6 p-4 rounded-[--radius-lg] bg-surface border border-border text-sm text-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-1">Result</p>
          <p>{ad.officialResult}</p>
        </div>
      )}

      {/* Turns */}
      {ad.turns.length > 0 && (
        <div className="flex flex-col gap-4 mb-8">
          {ad.turns.map((turn) => {
            const isProponent = turn.speaker === "proponent";
            return (
              <div key={turn.id} className={`flex flex-col gap-1 ${isProponent ? "" : "items-end"}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted px-1">
                  {speakers[turn.speaker] ?? turn.speaker} — {turn.roundName}
                </span>
                <div className={`max-w-[85%] rounded-[--radius-lg] px-4 py-3 text-sm leading-relaxed ${isProponent ? "bg-surface border border-border text-foreground" : "bg-brand/10 border border-brand/20 text-foreground"}`}>
                  {turn.content}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      {ad.linkUrl && (
        <div className="border-t border-border pt-6 flex justify-center">
          <a
            href={ad.linkUrl.startsWith("http") ? ad.linkUrl : `https://${ad.linkUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[--radius] bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors"
          >
            Visit {ad.businessName ?? "Website"} <ExternalLink size={13} />
          </a>
        </div>
      )}
    </div>
  );
}
