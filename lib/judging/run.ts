import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import { createNotification } from "@/lib/notifications";
import { runJudgePanel, JUDGE_CONFIGS } from "./service";
import { generateFeedbackOnly } from "./openrouter-provider";
import type { JudgeInput } from "./types";
import { computeNewRating, DEFAULT_ELO } from "@/lib/elo";

/** In-process set to prevent concurrent judging of the same debate. */
const inFlightJudging = new Set<string>();

/**
 * Full judging pipeline for a completed debate.
 * Fetches turns, runs judge panel, stores results, updates ELO, fires notifications.
 */
export async function judgeDebate(debateId: string): Promise<void> {
  if (inFlightJudging.has(debateId)) {
    console.log(`[judgeDebate] Already in-flight for ${debateId}, skipping.`);
    return;
  }
  inFlightJudging.add(debateId);
  try {
    await _judgeDebate(debateId);
  } finally {
    inFlightJudging.delete(debateId);
  }
}

async function _judgeDebate(debateId: string): Promise<void> {
  const debate = await db.debate.findUnique({
    where: { id: debateId },
    include: {
      debaterA: { select: { id: true, username: true, elo: true, rankedDebatesPlayed: true } },
      debaterB: { select: { id: true, username: true, elo: true, rankedDebatesPlayed: true } },
      turns: { orderBy: { submittedAt: "asc" } },
      challenge: { select: { id: true } },
    },
  });

  if (!debate) throw new Error(`Debate ${debateId} not found`);
  if (debate.status !== "completed") throw new Error("Debate not yet completed");

  const input: JudgeInput = {
    motion: debate.motion,
    format: debate.format,
    debaterA: debate.debaterA,
    debaterB: debate.debaterB,
    coinFlipWinnerId: debate.coinFlipWinnerId ?? debate.debaterAId,
    turns: debate.turns.map((t) => ({
      userId: t.userId,
      roundName: t.roundName,
      content: t.content,
    })),
  };

  const consensus = await runJudgePanel(input);

  // Delete any previous judge results so rejudges don't accumulate rows
  await db.judgeResult.deleteMany({ where: { debateId: debate.id } });

  // Store one JudgeResult per individual judge (with leaning label as judgeId)
  for (let i = 0; i < consensus.judgeVerdicts.length; i++) {
    const v = consensus.judgeVerdicts[i];
    const config = JUDGE_CONFIGS[i];
    await db.judgeResult.create({
      data: {
        debateId: debate.id,
        judgeId: config?.id ?? `judge-${i + 1}`,
        winnerId: v.winnerId,
        explanation: v.explanation,
        privateFeedbackA: v.privateFeedbackA,
        privateFeedbackB: v.privateFeedbackB,
        roundScores: JSON.stringify({ scoresA: v.scoresA ?? null, scoresB: v.scoresB ?? null }),
        evidenceChecks: JSON.stringify(v.evidenceChecks ?? []),
      },
    });
  }

  // Store consensus result
  await db.judgeResult.create({
    data: {
      debateId: debate.id,
      judgeId: "consensus",
      winnerId: consensus.winnerId,
      explanation: consensus.explanation,
      privateFeedbackA: consensus.privateFeedbackA ?? null,
      privateFeedbackB: consensus.privateFeedbackB ?? null,
      roundScores: JSON.stringify({
        scoresA: consensus.scoresA ?? null,
        scoresB: consensus.scoresB ?? null,
        biggestMistakeA: consensus.biggestMistakeA ?? null,
        biggestAchievementA: consensus.biggestAchievementA ?? null,
        biggestMistakeB: consensus.biggestMistakeB ?? null,
        biggestAchievementB: consensus.biggestAchievementB ?? null,
        improvementA: consensus.improvementA ?? null,
        improvementB: consensus.improvementB ?? null,
      }),
      evidenceChecks: JSON.stringify(consensus.evidenceChecks ?? []),
    },
  });

  // Update debate with official winner AFTER all judge results are stored
  await db.debate.update({
    where: { id: debate.id },
    data: { winnerId: consensus.winnerId },
  });

  // Update Elo ratings and win/loss counts atomically (ranked debates only)
  // Only update if this debate hasn't already been processed (prevent duplicates)
  if (debate.ranked) {
    const rA = debate.debaterA.elo ?? DEFAULT_ELO;
    const rB = debate.debaterB.elo ?? DEFAULT_ELO;
    const rdpA = debate.debaterA.rankedDebatesPlayed ?? 0;
    const rdpB = debate.debaterB.rankedDebatesPlayed ?? 0;

    const isTie = !consensus.winnerId;
    const aWon = consensus.winnerId === debate.debaterAId;

    const aResult = aWon ? "win" : isTie ? "tie" : "loss";
    const bResult = aWon ? "loss" : isTie ? "tie" : "win";

    const newEloA = computeNewRating(rA, rB, aResult, rdpA);
    const newEloB = computeNewRating(rB, rA, bResult, rdpB);

    const aWinLoss =
      aResult === "win" ? { wins: { increment: 1 } } :
      aResult === "loss" ? { losses: { increment: 1 } } : {};

    const bWinLoss =
      bResult === "win" ? { wins: { increment: 1 } } :
      bResult === "loss" ? { losses: { increment: 1 } } : {};

    await db.$transaction([
      db.user.update({
        where: { id: debate.debaterAId },
        data: { elo: newEloA, rankedDebatesPlayed: { increment: 1 }, ...aWinLoss },
      }),
      db.user.update({
        where: { id: debate.debaterBId },
        data: { elo: newEloB, rankedDebatesPlayed: { increment: 1 }, ...bWinLoss },
      }),
    ]);
  }

  // Notify both debaters
  const challengeId = debate.challenge?.id ?? debate.challengeId;
  const resultHref = `/debates/${challengeId}/results`;
  await Promise.all([
    createNotification(debate.debaterAId, {
      type: "result_ready",
      title: "Your debate result is in",
      body:
        consensus.winnerId === debate.debaterAId
          ? "You won! The AI judges ruled in your favour."
          : consensus.winnerId === debate.debaterBId
            ? `${debate.debaterB.username} won this one. Check the full breakdown.`
            : "It's a tie! The panel was evenly split.",
      href: resultHref,
      challengeId,
    }),
    createNotification(debate.debaterBId, {
      type: "result_ready",
      title: "Your debate result is in",
      body:
        consensus.winnerId === debate.debaterBId
          ? "You won! The AI judges ruled in your favour."
          : consensus.winnerId === debate.debaterAId
            ? `${debate.debaterA.username} won this one. Check the full breakdown.`
            : "It's a tie! The panel was evenly split.",
      href: resultHref,
      challengeId,
    }),
  ]);

  // Notify the arena that judging is complete
  await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, {
    phase: "completed",
    judged: true,
    winnerId: consensus.winnerId,
  });

  // Generate structured private feedback using the admin-configured prompt.
  // Runs after the debate is already marked complete so it doesn't block results.
  const feedbackApiKey = process.env.JUDGE_C_API_KEY ?? process.env.JUDGE_A_API_KEY ?? "";
  if (feedbackApiKey) {
    void generateFeedbackOnly(input, { apiKey: feedbackApiKey, model: process.env.JUDGE_C_MODEL })
      .then(({ feedbackA, feedbackB }) =>
        db.judgeResult.updateMany({
          where: { debateId: debate.id, judgeId: "consensus" },
          data: { privateFeedbackA: feedbackA, privateFeedbackB: feedbackB },
        })
      )
      .catch((err) => console.error("[judgeDebate] feedback generation failed:", err));
  }
}

/**
 * Regenerates ONLY the private feedback fields for an already-judged debate.
 * Uses a single fast AI call — does not re-run the full 3-judge panel.
 */
export async function regeneratePrivateFeedback(debateId: string): Promise<void> {
  const debate = await db.debate.findUnique({
    where: { id: debateId },
    include: {
      debaterA: { select: { id: true, username: true } },
      debaterB: { select: { id: true, username: true } },
      turns: { orderBy: { submittedAt: "asc" } },
    },
  });
  if (!debate) throw new Error(`Debate ${debateId} not found`);

  const input: JudgeInput = {
    motion: debate.motion,
    format: debate.format,
    debaterA: debate.debaterA,
    debaterB: debate.debaterB,
    coinFlipWinnerId: debate.coinFlipWinnerId ?? debate.debaterAId,
    turns: debate.turns.map((t) => ({
      userId: t.userId,
      roundName: t.roundName,
      content: t.content,
    })),
  };

  const apiKey = process.env.JUDGE_C_API_KEY ?? process.env.JUDGE_A_API_KEY ?? "";
  const model = process.env.JUDGE_C_MODEL;
  const { feedbackA, feedbackB } = await generateFeedbackOnly(input, { apiKey, model });

  // Update the consensus judge result
  await db.judgeResult.updateMany({
    where: { debateId: debate.id, judgeId: "consensus" },
    data: { privateFeedbackA: feedbackA, privateFeedbackB: feedbackB },
  });
}
