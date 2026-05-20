/**
 * Debate state-machine helpers shared across server API routes and client pages.
 * No server-only imports — safe to import in client components.
 */

/**
 * Round names for the new 8-turn structured format:
 *   opening → crossfire → rebuttal → summary
 *
 * "closing" is kept in the union only for backward-compat rendering of old debates
 * stored in the database before the format change.
 */
export type RoundName = "opening" | "crossfire" | "rebuttal" | "summary" | "closing";
export type DebatePhase = "prep" | "typing" | "second_chance" | "completed";

export interface TurnSpec {
  userId: string;
  roundName: RoundName;
  turnIndex: number;
}

export const ROUND_LABEL: Record<RoundName, string> = {
  opening:  "Opening Constructive",
  crossfire: "Crossfire",
  rebuttal:  "Rebuttal",
  summary:   "Closing Summary",
  closing:   "Closing Argument", // legacy
};

/**
 * Short UI hint shown to each debater during their turn.
 * Tells them what they should be doing in this phase.
 */
export const ROUND_HINT: Record<RoundName, string> = {
  opening:
    "Establish your position clearly. Introduce your strongest arguments and key evidence. Your opponent has not spoken yet — build your case.",
  crossfire:
    "Engage your opponent directly. Ask sharp questions challenging their claims, or answer the questions posed to you. Be concise and pointed — this is not another speech.",
  rebuttal:
    "Directly attack your opponent's arguments. Defend your own case against their attacks. Engage every significant claim they made in the opening and crossfire.",
  summary:
    "Crystallise why you won. Focus on the 1–2 most critical clash points. Do NOT introduce new arguments — only consolidate what has already been debated.",
  closing:
    "Deliver your final argument.", // legacy
};

/** Minimum characters required per round for a voluntary (non-auto) submission. */
export function getMinChars(roundName: RoundName): number {
  if (roundName === "crossfire") return 20;
  if (roundName === "summary")   return 30;
  return 50; // opening, rebuttal
}

/** Hard server-side character cap per round to prevent abuse. */
export function getMaxChars(roundName: RoundName): number {
  if (roundName === "crossfire") return 1000;
  if (roundName === "summary")   return 1200;
  if (roundName === "opening")   return 4000;
  return 2500; // rebuttal
}

/** @deprecated Use getMinChars / getMaxChars instead */
export const MIN_CHARS = 50;
/** @deprecated Use getMaxChars instead */
export const MAX_CHARS = 4000;

/** Preparation phase duration in seconds. */
export const PREP_SECONDS = 30;

/** Window in seconds after an expired turn in which a second chance can be invoked. */
export const SECOND_CHANCE_WINDOW_SECONDS = 30;

/**
 * Per-round timer in seconds.
 *
 * Standard format (exactly 15:00 total):
 *   opening:   3:00 × 2 =  6:00
 *   crossfire: 1:30 × 2 =  3:00
 *   rebuttal:  2:00 × 2 =  4:00
 *   summary:   1:00 × 2 =  2:00
 *   TOTAL = 15:00
 *
 * Quick format (exactly 7:30 total):
 *   opening:  1:30 × 2 = 3:00
 *   crossfire: 0:45 × 2 = 1:30
 *   rebuttal:  1:00 × 2 = 2:00
 *   summary:   0:30 × 2 = 1:00
 *   TOTAL = 7:30
 */
const ROUND_TIMERS: Record<string, Record<RoundName, number>> = {
  quick:    { opening: 90,  crossfire: 45, rebuttal: 60,  summary: 30,  closing: 60  },
  standard: { opening: 180, crossfire: 90, rebuttal: 120, summary: 60,  closing: 90  },
};

export function getRoundTimer(format: string, roundName: RoundName): number {
  return ROUND_TIMERS[format]?.[roundName] ?? ROUND_TIMERS.standard[roundName] ?? 120;
}

/**
 * Returns the ordered turn sequence for a debate.
 *
 * New standard 8-turn structure (15 min total):
 *   Turn 0: Proposition — Opening Constructive  (3:00)
 *   Turn 1: Opposition  — Opening Constructive  (3:00)
 *   Turn 2: Proposition — Crossfire             (1:30)
 *   Turn 3: Opposition  — Crossfire             (1:30)
 *   Turn 4: Proposition — Rebuttal              (2:00)
 *   Turn 5: Opposition  — Rebuttal              (2:00)
 *   Turn 6: Proposition — Closing Summary       (1:00)
 *   Turn 7: Opposition  — Closing Summary       (1:00)
 *
 * The coin-flip winner is always Proposition (speaks first in every phase).
 */
export function getTurnSequence(
  _format: string,
  coinFlipWinnerId: string,
  debaterAId: string,
  debaterBId: string,
): TurnSpec[] {
  const first  = coinFlipWinnerId;
  const second = first === debaterAId ? debaterBId : debaterAId;

  return [
    { userId: first,  roundName: "opening",   turnIndex: 0 },
    { userId: second, roundName: "opening",   turnIndex: 1 },
    { userId: first,  roundName: "crossfire", turnIndex: 2 },
    { userId: second, roundName: "crossfire", turnIndex: 3 },
    { userId: first,  roundName: "rebuttal",  turnIndex: 4 },
    { userId: second, roundName: "rebuttal",  turnIndex: 5 },
    { userId: first,  roundName: "summary",   turnIndex: 6 },
    { userId: second, roundName: "summary",   turnIndex: 7 },
  ];
}

/** Format seconds as mm:ss */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
