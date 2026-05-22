"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sparkles, RefreshCw } from "lucide-react";

interface CompassCoords {
  economic: number; // -1 (left) to +1 (right)
  social: number;   // -1 (libertarian/bottom) to +1 (authoritarian/top)
}

interface ParsedAssessment {
  // v3 fields
  argumentStyle?: string;
  ideologicalTendency?: string;
  confidenceNote?: string;
  compassLabel?: string;
  confidenceLevel?: string;
  compass: CompassCoords | null;
  // legacy v2 fallback
  text?: string;
}

function parseAssessment(raw: string | null): ParsedAssessment {
  if (!raw) return { compass: null };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const compass =
      obj.compass &&
      typeof (obj.compass as Record<string, unknown>).economic === "number" &&
      typeof (obj.compass as Record<string, unknown>).social === "number"
        ? {
            economic: (obj.compass as Record<string, unknown>).economic as number,
            social: (obj.compass as Record<string, unknown>).social as number,
          }
        : null;

    // v3 structured
    if (typeof obj.argumentStyle === "string") {
      return {
        argumentStyle: obj.argumentStyle,
        ideologicalTendency: typeof obj.ideologicalTendency === "string" ? obj.ideologicalTendency : undefined,
        confidenceNote: typeof obj.confidenceNote === "string" ? obj.confidenceNote : undefined,
        compassLabel: typeof obj.compassLabel === "string" ? obj.compassLabel : undefined,
        confidenceLevel: typeof obj.confidenceLevel === "string" ? obj.confidenceLevel : undefined,
        compass,
      };
    }
    // v2 legacy
    if (typeof obj.text === "string") {
      return { text: obj.text, compass };
    }
  } catch {
    // plain text fallback
  }
  return { text: raw, compass: null };
}

const CONFIDENCE_COLORS: Record<string, string> = {
  "Very Low": "text-foreground-muted",
  "Low": "text-warning",
  "Moderate": "text-brand",
  "High": "text-success",
};

function CompassChart({ coords, label, confidenceLevel }: { coords: CompassCoords; label?: string; confidenceLevel?: string }) {
  const SIZE = 220;
  const HALF = SIZE / 2;
  const RANGE = 90;

  const dotX = HALF + coords.economic * RANGE;
  const dotY = HALF - coords.social * RANGE;

  return (
    <div className="mt-5 flex flex-col items-center">
      <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wide mb-3">Political Compass</p>
      <div className="relative inline-block">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="rounded-[--radius] ring-1 ring-border"
        >
          <rect x={0} y={0} width={HALF} height={HALF} fill="rgba(239,68,68,0.15)" />
          <rect x={HALF} y={0} width={HALF} height={HALF} fill="rgba(59,130,246,0.15)" />
          <rect x={0} y={HALF} width={HALF} height={HALF} fill="rgba(34,197,94,0.15)" />
          <rect x={HALF} y={HALF} width={HALF} height={HALF} fill="rgba(234,179,8,0.15)" />
          <line x1={HALF} y1={4} x2={HALF} y2={SIZE - 4} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          <line x1={4} y1={HALF} x2={SIZE - 4} y2={HALF} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          <text x={6} y={HALF - 5} fontSize={9} fill="currentColor" fillOpacity={0.45}>Left</text>
          <text x={SIZE - 28} y={HALF - 5} fontSize={9} fill="currentColor" fillOpacity={0.45}>Right</text>
          <text x={HALF + 4} y={13} fontSize={9} fill="currentColor" fillOpacity={0.45}>Auth.</text>
          <text x={HALF + 4} y={SIZE - 4} fontSize={9} fill="currentColor" fillOpacity={0.45}>Lib.</text>
          <circle cx={dotX} cy={dotY} r={9} fill="black" fillOpacity={0.12} />
          <circle cx={dotX} cy={dotY} r={7} fill="white" stroke="currentColor" strokeWidth={2} />
          <circle cx={dotX} cy={dotY} r={3} fill="currentColor" />
        </svg>
      </div>
      {label && (
        <p className="text-xs font-medium text-foreground mt-2 text-center">{label}</p>
      )}
      {confidenceLevel && (
        <p className={`text-xs mt-1 ${CONFIDENCE_COLORS[confidenceLevel] ?? "text-foreground-muted"}`}>
          Confidence: {confidenceLevel}
        </p>
      )}
      <p className="text-[11px] text-foreground-subtle mt-1.5 text-center max-w-[220px] leading-snug">
        Inferred from your debate positions — not a definitive label.
      </p>
    </div>
  );
}

interface AssessmentSectionProps {
  assessment?: string | null;
  updatedAt?: Date | null;
}

export function AssessmentSection({ assessment: initialAssessment, updatedAt: initialUpdatedAt }: AssessmentSectionProps) {
  const [rawAssessment, setRawAssessment] = useState(initialAssessment ?? null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(initialUpdatedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parsed = parseAssessment(rawAssessment);

  const requestAssessment = async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/profile/assess${force ? "?force=true" : ""}`, { method: "POST" });
      const data = await res.json() as { assessment?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to generate assessment.");
      } else {
        setRawAssessment(data.assessment ?? null);
        setUpdatedAt(new Date());
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hasContent = parsed.argumentStyle || parsed.text;

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-brand" />
            <h3 className="text-base font-semibold text-foreground">Assessment</h3>
          </div>
          {hasContent && (
            <button
              onClick={() => requestAssessment(true)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
              title="Force update (bypasses weekly cooldown)"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>

        {hasContent ? (
          <>
            {/* v3 structured */}
            {parsed.argumentStyle && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wide mb-1">Argument Style</p>
                  <p className="text-sm text-foreground leading-relaxed">{parsed.argumentStyle}</p>
                </div>
                {parsed.ideologicalTendency && (
                  <div>
                    <p className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wide mb-1">Ideological Tendency</p>
                    <p className="text-sm text-foreground leading-relaxed">{parsed.ideologicalTendency}</p>
                  </div>
                )}
                {parsed.confidenceNote && (
                  <div className="rounded-[--radius] bg-surface-raised border border-border px-3 py-2.5">
                    <p className="text-xs text-foreground-muted leading-relaxed">{parsed.confidenceNote}</p>
                    {(parsed.confidenceLevel === "Very Low" || parsed.confidenceLevel === "Low") && (
                      <p className="text-xs text-foreground-subtle mt-1">
                        Complete more debates across different categories to improve accuracy.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* v2 legacy */}
            {!parsed.argumentStyle && parsed.text && (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{parsed.text}</p>
            )}

            {parsed.compass && (
              <CompassChart
                coords={parsed.compass}
                label={parsed.compassLabel}
                confidenceLevel={parsed.confidenceLevel}
              />
            )}

            {updatedAt && (
              <p className="text-xs text-foreground-subtle mt-4">
                Last updated: {updatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                &nbsp;· Updates automatically weekly.
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <Sparkles size={24} className="text-foreground-subtle mx-auto mb-3" />
            <p className="text-sm text-foreground-muted mb-4">
              Complete at least one debate to unlock your personalized assessment.
            </p>
            <Button size="sm" onClick={() => requestAssessment(false)} isLoading={loading}>
              <Sparkles size={14} />
              Generate Assessment
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-danger bg-danger/10 border border-danger/20 rounded-[--radius] px-3 py-2">
            {error}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
