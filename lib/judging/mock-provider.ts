import type { IJudgingProvider, JudgeInput, SingleJudgeVerdict } from "./types";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

    return {
      winnerId,
      explanation: `${winner.username} delivered a ${pick(STRENGTH_ADJ)} argument throughout the debate, while ${loser.username}'s case was ${pick(WEAK_ADJ)}. The panel awards the debate to ${winner.username}.`,
      privateFeedbackA: `${debaterA.username}, your arguments showed ${pick(STRENGTH_ADJ)} reasoning. Focus on grounding your claims with specific evidence and engaging your opponent's strongest points.`,
      privateFeedbackB: `${debaterB.username}, you maintained ${pick(STRENGTH_ADJ)} structure throughout. Consider adding concrete statistics to support your claims for a more convincing case.`,
      evidenceChecks: [],
    };
  }
}


