/**
 * Debate state-machine helpers shared across server API routes and client pages.
 * No server-only imports — safe to import in client components.
 */

export type RoundName = "opening" | "rebuttal" | "closing";
export type DebatePhase = "prep" | "typing" | "second_chance" | "completed";

export interface TurnSpec {
  userId: string;
  roundName: RoundName;
  turnIndex: number;
}

export const ROUND_LABEL: Record<RoundName, string> = {
  opening: "Opening Statement",
  rebuttal: "Rebuttal",
  closing: "Closing Argument",
};

/** Minimum characters required for a voluntary (non-auto) submission. */
export const MIN_CHARS = 50;

/** Hard server-side cap to prevent abuse. */
export const MAX_CHARS = 4000;

/** Preparation phase duration in seconds. */
export const PREP_SECONDS = 30;

/** Window in seconds after an expired turn in which a second chance can be invoked. */
export const SECOND_CHANCE_WINDOW_SECONDS = 30;

/** Per-round timer in seconds, keyed by format then round.
 *  quick:    opening=2 min, rebuttal=2 min, closing=1 min   (~10 min total)
 *  standard: opening=3 min, rebuttal=3 min, closing=1.5 min (~15 min total)
 */
const ROUND_TIMERS: Record<string, Record<RoundName, number>> = {
  quick:    { opening: 120, rebuttal: 120, closing: 60 },
  standard: { opening: 180, rebuttal: 180, closing: 90 },
};

export function getRoundTimer(format: string, roundName: RoundName): number {
  return ROUND_TIMERS[format]?.[roundName] ?? ROUND_TIMERS.standard[roundName];
}

/**
 * Returns the ordered turn sequence for a debate.
 * Both formats: opening-opening-rebuttal-rebuttal-closing-closing (6 turns)
 * The coin-flip winner always speaks first in each round.
 */
export function getTurnSequence(
  _format: string,
  coinFlipWinnerId: string,
  debaterAId: string,
  debaterBId: string,
): TurnSpec[] {
  const first = coinFlipWinnerId;
  const second = first === debaterAId ? debaterBId : debaterAId;

  return [
    { userId: first,  roundName: "opening",  turnIndex: 0 },
    { userId: second, roundName: "opening",  turnIndex: 1 },
    { userId: first,  roundName: "rebuttal", turnIndex: 2 },
    { userId: second, roundName: "rebuttal", turnIndex: 3 },
    { userId: first,  roundName: "closing",  turnIndex: 4 },
    { userId: second, roundName: "closing",  turnIndex: 5 },
  ];
}

/** Format seconds as mm:ss */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
