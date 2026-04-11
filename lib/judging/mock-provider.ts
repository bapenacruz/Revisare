import type { IJudgingProvider, JudgeInput, SingleJudgeVerdict, DebaterScores } from "./types";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mockScores(seed: number): DebaterScores {
  // Deterministic-ish scores based on argument length seed
  const base = 4 + (seed % 4); // 4–7
  const factuality = Math.min(10, base + (seed % 3));
  const evidence_quality = Math.min(10, base - 1 + (seed % 2));
  const argument_strength = Math.min(10, base + 1 - (seed % 2));
  const rebuttal_quality = Math.min(10, base - (seed % 2));
  const clarity = Math.min(10, base + 2 - (seed % 3));
  const persuasiveness = Math.min(10, base + (seed % 2));
  let final_score =
    factuality * 0.35 + evidence_quality * 0.25 + argument_strength * 0.15 +
    rebuttal_quality * 0.15 + clarity * 0.05 + persuasiveness * 0.05;
  if (factuality < 3) final_score = Math.min(final_score, 3);
  else if (factuality < 5) final_score = Math.min(final_score, 6);
  return { factuality, evidence_quality, argument_strength, rebuttal_quality, clarity, persuasiveness,
    final_score: Math.round(final_score * 10) / 10 };
}

const STRENGTH_ADJ = ["compelling", "well-structured", "logically coherent", "evidence-backed", "persuasive"];
const WEAK_ADJ = ["somewhat underdeveloped", "lacking concrete evidence", "could be strengthened"];

export class MockJudgingProvider implements IJudgingProvider {
  readonly name = "mock";

  async judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    const { debaterA, debaterB, turns } = input;

    const aTurns = turns.filter((t) => t.userId === debaterA.id);
    const bTurns = turns.filter((t) => t.userId === debaterB.id);

    const avgALen = aTurns.length ? aTurns.reduce((s, t) => s + t.content.length, 0) / aTurns.length : 0;
    const avgBLen = bTurns.length ? bTurns.reduce((s, t) => s + t.content.length, 0) / bTurns.length : 0;

    const winnerId = avgALen >= avgBLen ? debaterA.id : debaterB.id;
    const winner = winnerId === debaterA.id ? debaterA : debaterB;
    const loser = winner.id === debaterA.id ? debaterB : debaterA;

    const seedA = Math.round(avgALen) % 7;
    const seedB = Math.round(avgBLen) % 7;

    return {
      winnerId,
      explanation: `${winner.username} delivered a ${pick(STRENGTH_ADJ)} argument throughout the debate, while ${loser.username}'s case was ${pick(WEAK_ADJ)}. The panel awards the debate to ${winner.username}.`,
      privateFeedbackA: `${debaterA.username}, your arguments showed ${pick(STRENGTH_ADJ)} reasoning. Focus on grounding your claims with specific evidence and engaging your opponent's strongest points.`,
      privateFeedbackB: `${debaterB.username}, you maintained ${pick(STRENGTH_ADJ)} structure throughout. Consider adding concrete statistics to support your claims for a more convincing case.`,
      evidenceChecks: [],
      scoresA: mockScores(seedA),
      scoresB: mockScores(seedB),
      biggestMistakeA: "Relied on assertion without sufficient supporting evidence at key moments.",
      biggestAchievementA: "Maintained a clear and structured argument across all rounds.",
      biggestMistakeB: "Missed opportunities to directly rebut the strongest opposing claims.",
      biggestAchievementB: "Demonstrated strong understanding of the topic with well-reasoned points.",
    };
  }
}


