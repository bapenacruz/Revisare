import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import {
  getTurnSequence,
  MIN_CHARS,
  MAX_CHARS,
  SECOND_CHANCE_WINDOW_SECONDS,
  getRoundTimer,
} from "@/lib/debate-state";
import { judgeDebate } from "@/lib/judging";

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

  // Content validation
  if (content.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Response exceeds maximum ${MAX_CHARS} characters.` },
      { status: 400 },
    );
  }
  if (!autoSubmit && content.length < MIN_CHARS) {
    return NextResponse.json(
      { error: `Response must be at least ${MIN_CHARS} characters.` },
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
  const sequence = getTurnSequence(
    debate.format,
    debate.coinFlipWinnerId!,
    debate.debaterAId,
    debate.debaterBId,
  );
  const currentSpec = sequence[debate.currentTurnIndex];

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
          roundScores: "[]",
        },
      });
    }

    return NextResponse.json({ phase: "completed" });
  }

  // Advance to next turn
  const nextSpec = sequence[nextIndex];
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

  return NextResponse.json({ phase: "typing", nextUserId: nextSpec.userId });
}
