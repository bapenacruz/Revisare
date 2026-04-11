/**
 * True Elo rating system helpers.
 *
 * K-factors:
 *   K = 40  — provisional  (fewer than 5 ranked debates played)
 *   K = 24  — established  (5 or more ranked debates played)
 *
 * Default starting rating: 1000
 */

export const DEFAULT_ELO = 1000;

const K_PROVISIONAL = 40;
const K_ESTABLISHED = 24;
const PROVISIONAL_THRESHOLD = 5;

/** Probability that a player beats an opponent, given both ratings. */
export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/** K = 40 during provisional phase, 24 once established. */
export function getKFactor(rankedDebatesPlayed: number): number {
  return rankedDebatesPlayed < PROVISIONAL_THRESHOLD ? K_PROVISIONAL : K_ESTABLISHED;
}

/** Actual score: win = 1, tie = 0.5, loss = 0. */
export function getActualScore(result: "win" | "loss" | "tie"): number {
  if (result === "win") return 1;
  if (result === "tie") return 0.5;
  return 0;
}

/**
 * Compute a player's new Elo rating after a ranked debate.
 * Returns the new rating rounded to the nearest integer.
 */
export function computeNewRating(
  playerRating: number,
  opponentRating: number,
  result: "win" | "loss" | "tie",
  rankedDebatesPlayed: number,
): number {
  const E = expectedScore(playerRating, opponentRating);
  const S = getActualScore(result);
  const K = getKFactor(rankedDebatesPlayed);
  return Math.round(playerRating + K * (S - E));
}
