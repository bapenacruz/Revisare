import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import {
  getTurnSequence,
  getMinChars,
  getMaxChars,
  PREP_SECONDS,
  SECOND_CHANCE_WINDOW_SECONDS,
  THINKING_SECONDS,
  getRoundTimer,
  type RoundName,
  type TurnSpec,
} from "@/lib/debate-state";
import { judgeDebate } from "@/lib/judging";
import { AI_OPPONENT_USER_ID, generateAiOpponentTurn } from "@/lib/ai-opponent";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: challengeId } = await params;
  const body = await req.json();
  const content: string = (body.content ?? "").trim();
  const autoSubmit: boolean = body.autoSubmit === true;

  const debate = await db.debate.findUnique({ where: { challengeId } });
  if (!debate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (debate.phase !== "typing") {
    return NextResponse.json({ error: "Not in typing phase" }, { status: 400 });
  }
  if (debate.currentUserId !== session.user.id) {
    return NextResponse.json({ error: "Not your turn" }, { status: 403 });
  }

  // Compute turn sequence once — used for validation and state advance
  const sequence = getTurnSequence(
    debate.format,
    debate.coinFlipWinnerId!,
    debate.debaterAId,
    debate.debaterBId,
  );
  const currentSpec = sequence[debate.currentTurnIndex];
  const roundMaxChars = getMaxChars(currentSpec?.roundName as RoundName ?? "opening");
  const roundMinChars = getMinChars(currentSpec?.roundName as RoundName ?? "opening");

  if (content.length > roundMaxChars) {
    return NextResponse.json(
      { error: `Response exceeds maximum ${roundMaxChars} characters for this phase.` },
      { status: 400 },
    );
  }
  if (!autoSubmit && content.length < roundMinChars) {
    return NextResponse.json(
      { error: `Response must be at least ${roundMinChars} characters for this phase.` },
      { status: 400 },
    );
  }

  // Empty auto-submit: trigger second-chance flow
  if (autoSubmit && content.length === 0) {
    // If already used second chance → forfeit immediately
    if (debate.secondChanceUserId === session.user.id) {
      const opponentId =
        debate.debaterAId === session.user.id ? debate.debaterBId : debate.debaterAId;
      const now = new Date();
      await db.debate.update({
        where: { challengeId },
        data: {
          phase: "completed",
          status: "completed",
          forfeitedBy: session.user.id,
          winnerId: opponentId,
          completedAt: now,
        },
      });
      if (debate.ranked) {
        await db.user.update({
          where: { id: opponentId },
          data: { wins: { increment: 1 }, elo: { increment: 25 } },
        });
        await db.user.update({
          where: { id: session.user.id },
          data: { losses: { increment: 1 }, elo: { decrement: 25 } },
        });
      }
      await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, {
        phase: "completed",
        forfeit: true,
      });
      // Create a minimal judge result so the results page shows the outcome
      await db.judgeResult.create({
        data: {
          debateId: debate.id,
          judgeId: "forfeit",
          winnerId: opponentId,
          explanation: "This debate ended by forfeit. The win has been awarded to the opponent.",
          privateFeedbackA: null,
          privateFeedbackB: null,
          roundScores: "[]",
        },
      }).catch(() => undefined);
      return NextResponse.json({ phase: "completed", forfeit: true });
    }

    // First empty submission — offer second chance (30s window)
    const expiresAt = new Date(Date.now() + SECOND_CHANCE_WINDOW_SECONDS * 1000);
    await db.debate.update({
      where: { challengeId },
      data: {
        phase: "second_chance",
        secondChancePending: true,
        secondChanceRequesterId: session.user.id,
        secondChanceExpiresAt: expiresAt,
      },
    });
    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_SECOND_CHANCE, {
      requesterId: session.user.id,
      expiresAt,
    });
    return NextResponse.json({ phase: "second_chance", expiresAt });
  }

  // Save the turn

  await db.debateTurn.create({
    data: {
      debateId: debate.id,
      userId: session.user.id,
      roundName: currentSpec.roundName,
      content,
      isAutoSubmit: autoSubmit,
    },
  });

  // Log rapid-submission signal (< 15s after timer started)
  if (debate.timerStartedAt) {
    const elapsed = (Date.now() - debate.timerStartedAt.getTime()) / 1000;
    if (elapsed < 15 && !autoSubmit) {
      await db.suspiciousTurnSignal.create({
        data: {
          debateId: debate.id,
          userId: session.user.id,
          signal: "rapid_submission",
          detail: `Submitted in ${Math.round(elapsed)}s`,
        },
      }).catch(() => undefined); // non-blocking, best-effort
    }
  }

  const nextIndex = debate.currentTurnIndex + 1;
  const now = new Date();

  if (nextIndex >= sequence.length) {
    // Debate complete — mark completed, then run AI judging
    await db.debate.update({
      where: { challengeId },
      data: {
        phase: "completed",
        status: "completed",
        currentTurnIndex: nextIndex,
        currentUserId: null,
        completedAt: now,
        // winnerId will be set by judgeDebate after AI panel completes
      },
    });

    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, {
      phase: "completed",
    });

    // Run AI judging (awaited so ELO + notifications fire before response)
    try {
      await judgeDebate(debate.id);
    } catch (err) {
      console.error("[Judging] Failed, applying fallback:", err);
      // Fallback: random winner so the debate doesn't stay in limbo
      const fallbackWinner = Math.random() < 0.5 ? debate.debaterAId : debate.debaterBId;
      await db.debate.update({ where: { id: debate.id }, data: { winnerId: fallbackWinner } });
      await db.judgeResult.create({
        data: {
          debateId: debate.id,
          judgeId: "fallback",
          winnerId: fallbackWinner,
          explanation: "Judging encountered an error. A provisional result was assigned.",
          privateFeedbackA: null,
          privateFeedbackB: null,
          roundScores: JSON.stringify({}),
          evidenceChecks: JSON.stringify([]),
        },
      });
    }

    return NextResponse.json({ phase: "completed" });
  }

  // Advance to next turn
  const nextSpec = sequence[nextIndex];
  const isNextAi = debate.isAiOpponent && nextSpec.userId === AI_OPPONENT_USER_ID;

  // After proposition's opening (turn 0 → turn 1), give opposition 1 min to think
  // Skip thinking phase if opponent is AI (instant)
  if (debate.currentTurnIndex === 0 && !isNextAi) {
    const thinkingEndsAt = new Date(now.getTime() + THINKING_SECONDS * 1000);
    await db.debate.update({
      where: { challengeId },
      data: {
        phase: "thinking",
        currentTurnIndex: nextIndex,
        currentUserId: nextSpec.userId,
        prepEndsAt: thinkingEndsAt,
        timerStartedAt: null,
        timerPreset: getRoundTimer(debate.format, nextSpec.roundName),
      },
    });
    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_TURN_SUBMITTED, {
      turnIndex: debate.currentTurnIndex,
      nextUserId: nextSpec.userId,
    });
    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, {
      phase: "thinking",
    });
    return NextResponse.json({ phase: "thinking", thinkingEndsAt });
  }

  // For all other human turns (1→2 through 6→7): 30s digest prep before typing starts.
  // AI turns skip this — they respond instantly.
  if (!isNextAi) {
    const prepEndsAt = new Date(now.getTime() + PREP_SECONDS * 1000);
    await db.debate.update({
      where: { challengeId },
      data: {
        phase: "prep",
        currentTurnIndex: nextIndex,
        currentUserId: nextSpec.userId,
        prepEndsAt,
        timerStartedAt: null,
        timerPreset: getRoundTimer(debate.format, nextSpec.roundName),
      },
    });
    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_TURN_SUBMITTED, {
      turnIndex: debate.currentTurnIndex,
      nextUserId: nextSpec.userId,
    });
    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, {
      phase: "prep",
    });
    return NextResponse.json({ phase: "prep", prepEndsAt });
  }

  // AI turn: go directly to typing and spawn AI generation
  await db.debate.update({
    where: { challengeId },
    data: {
      phase: "typing",
      currentTurnIndex: nextIndex,
      currentUserId: nextSpec.userId,
      timerStartedAt: now,
      timerPreset: getRoundTimer(debate.format, nextSpec.roundName),
    },
  });

  await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_TURN_SUBMITTED, {
    turnIndex: debate.currentTurnIndex,
    nextUserId: nextSpec.userId,
  });

  Promise.resolve()
    .then(() => executeAiTurn({ challengeId, debateId: debate.id, nextIndex, nextSpec, sequence, debate }))
    .catch((err) => console.error("[AI Turn] Background execution failed:", err));

  return NextResponse.json({ phase: "typing", nextUserId: nextSpec.userId });
}

// ── AI Turn Execution ────────────────────────────────────────────────────────

interface AiTurnOptions {
  challengeId: string;
  debateId: string;
  nextIndex: number;
  nextSpec: TurnSpec;
  sequence: TurnSpec[];
  debate: {
    debaterAId: string;
    debaterBId: string;
    motion: string;
    format: string;
    ranked: boolean;
    isAiOpponent: boolean;
    coinFlipWinnerId: string | null;
  };
}

async function executeAiTurn({ challengeId, debateId, nextIndex, nextSpec, sequence, debate }: AiTurnOptions) {
  // Load all turns so far
  const previousTurns = await db.debateTurn.findMany({
    where: { debateId },
    orderBy: { submittedAt: "asc" },
  });

  const userDebaterId = debate.debaterAId === AI_OPPONENT_USER_ID ? debate.debaterBId : debate.debaterAId;
  const userRecord = await db.user.findUnique({ where: { id: userDebaterId }, select: { username: true } });

  // Determine sides
  const aiSide: "proposition" | "opposition" = debate.debaterAId === AI_OPPONENT_USER_ID ? "proposition" : "opposition";
  const userSide: "proposition" | "opposition" = aiSide === "proposition" ? "opposition" : "proposition";

  const turnContexts = previousTurns.map((t) => ({
    userId: t.userId,
    username: t.userId === AI_OPPONENT_USER_ID ? "AI" : (userRecord?.username ?? "Opponent"),
    roundName: t.roundName,
    content: t.content,
  }));

  const category = await db.debate.findUnique({
    where: { id: debateId },
    include: { category: { select: { label: true } } },
  });

  const aiText = await generateAiOpponentTurn({
    motion: debate.motion,
    categoryLabel: category?.category?.label ?? "General",
    aiSide,
    userSide,
    roundName: nextSpec.roundName,
    previousTurns: turnContexts,
    userUsername: userRecord?.username ?? "Opponent",
  });

  if (!aiText) {
    console.error("[AI Turn] Failed to generate response, AI will auto-submit empty");
    // Trigger forfeit-style handling: just skip this turn (mark as auto-submit)
  }

  const content = aiText ?? "I concede this point and yield my time.";
  const now = new Date();

  await db.debateTurn.create({
    data: {
      debateId,
      userId: AI_OPPONENT_USER_ID,
      roundName: nextSpec.roundName,
      content,
      isAutoSubmit: !aiText,
    },
  });

  const afterAiIndex = nextIndex + 1;

  if (afterAiIndex >= sequence.length) {
    // Debate complete after AI turn
    await db.debate.update({
      where: { challengeId },
      data: {
        phase: "completed",
        status: "completed",
        currentTurnIndex: afterAiIndex,
        currentUserId: null,
        completedAt: now,
      },
    });
    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_TURN_SUBMITTED, {
      turnIndex: nextIndex,
      nextUserId: null,
    });
    await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, { phase: "completed" });

    try {
      await judgeDebate(debateId);
    } catch (err) {
      console.error("[AI Debate Judging] Failed:", err);
      // On failure, award the human so the debate doesn't stay in limbo with no result
      await db.debate.update({ where: { id: debateId }, data: { winnerId: userDebaterId } });
    }
    return;
  }

  // Advance to user's next turn
  const afterAiSpec = sequence[afterAiIndex];
  await db.debate.update({
    where: { challengeId },
    data: {
      phase: "typing",
      currentTurnIndex: afterAiIndex,
      currentUserId: afterAiSpec.userId,
      timerStartedAt: now,
      timerPreset: getRoundTimer(debate.format, afterAiSpec.roundName),
    },
  });
  await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_TURN_SUBMITTED, {
    turnIndex: nextIndex,
    nextUserId: afterAiSpec.userId,
  });
  await pusherTrigger(CHANNELS.debate(challengeId), EVENTS.DEBATE_STATE_CHANGED, { phase: "typing" });
}
