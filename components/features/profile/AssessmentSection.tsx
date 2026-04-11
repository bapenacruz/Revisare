"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sparkles, RefreshCw } from "lucide-react";

interface CompassCoords {
  economic: number; // -1 (left) to +1 (right)
  social: number;   // -1 (libertarian) to +1 (authoritarian)
}

interface ParsedAssessment {
  text: string;
  compass: CompassCoords | null;
}

function parseAssessment(raw: string | null): ParsedAssessment {
  if (!raw) return { text: "", compass: null };
  try {
    const obj = JSON.parse(raw) as { v?: number; text?: unknown; compass?: { economic?: unknown; social?: unknown } };
    if (typeof obj.text === "string") {
      const compass =
        obj.compass &&
        typeof obj.compass.economic === "number" &&
        typeof obj.compass.social === "number"
          ? { economic: obj.compass.economic, social: obj.compass.social }
          : null;
      return { text: obj.text, compass };
    }
  } catch {
    // Not JSON — legacy plain text
  }
  return { text: raw, compass: null };
}

function CompassChart({ coords }: { coords: CompassCoords }) {
  const SIZE = 220;
  const HALF = SIZE / 2;
  const RANGE = 90; // dot travel radius from center

  const dotX = HALF + coords.economic * RANGE;
  const dotY = HALF - coords.social * RANGE; // flip: authoritarian = top = low y

  return (
    <div className="mt-6 flex flex-col items-center">
      <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide mb-3">Political Compass</p>
      <div className="relative inline-block">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="rounded-[--radius] ring-1 ring-border"
        >
          {/* Quadrant fills */}
          {/* Auth-Left: top-left → red */}
          <rect x={0} y={0} width={HALF} height={HALF} fill="rgba(239,68,68,0.18)" />
          {/* Auth-Right: top-right → blue */}
          <rect x={HALF} y={0} width={HALF} height={HALF} fill="rgba(59,130,246,0.18)" />
          {/* Lib-Left: bottom-left → green */}
          <rect x={0} y={HALF} width={HALF} height={HALF} fill="rgba(34,197,94,0.18)" />
          {/* Lib-Right: bottom-right → yellow */}
          <rect x={HALF} y={HALF} width={HALF} height={HALF} fill="rgba(234,179,8,0.18)" />

          {/* Axis lines */}
          <line x1={HALF} y1={4} x2={HALF} y2={SIZE - 4} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          <line x1={4} y1={HALF} x2={SIZE - 4} y2={HALF} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />

          {/* Axis labels */}
          <text x={6} y={HALF - 5} fontSize={9} fill="currentColor" fillOpacity={0.45}>Left</text>
          <text x={SIZE - 28} y={HALF - 5} fontSize={9} fill="currentColor" fillOpacity={0.45}>Right</text>
          <text x={HALF + 4} y={13} fontSize={9} fill="currentColor" fillOpacity={0.45}>Auth.</text>
          <text x={HALF + 4} y={SIZE - 4} fontSize={9} fill="currentColor" fillOpacity={0.45}>Lib.</text>

          {/* Dot shadow */}
          <circle cx={dotX} cy={dotY} r={9} fill="black" fillOpacity={0.15} />
          {/* Dot */}
          <circle cx={dotX} cy={dotY} r={7} fill="white" stroke="currentColor" strokeWidth={2} />
          <circle cx={dotX} cy={dotY} r={3} fill="currentColor" />
        </svg>
      </div>
      <p className="text-xs text-foreground-subtle mt-2 text-center max-w-[220px]">
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

  const { text, compass } = parseAssessment(rawAssessment);

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

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-brand" />
            <h3 className="text-base font-semibold text-foreground">Assessment</h3>
          </div>
          {rawAssessment && (
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

        {rawAssessment ? (
          <>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{text}</p>
            {compass && <CompassChart coords={compass} />}
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
            <Button
              size="sm"
              onClick={() => requestAssessment(false)}
              isLoading={loading}
            >
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
