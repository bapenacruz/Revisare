import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { judgeDebate } from "@/lib/judging";

export async function POST(req: NextRequest) {
  try {
    // Only allow admin users
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Find all completed debates that need AI assessment
    const debatesNeedingAssessment = await db.debate.findMany({
      where: {
        status: "completed",
        phase: "completed",
        isDeleted: false, // Don't process deleted debates
        OR: [
          // Either no winner determined
          { winnerId: null },
          // Or no judge results exist
          { judgeResults: { none: {} } }
        ]
      },
      select: {
        id: true,
        motion: true,
        debaterA: { select: { username: true } },
        debaterB: { select: { username: true } },
        completedAt: true,
        judgeResults: { select: { id: true } },
        winnerId: true
      },
      orderBy: { completedAt: 'asc' } // Process oldest first
    });

    console.log(`[AI Assessment] Found ${debatesNeedingAssessment.length} debates needing AI assessment`);

    const results = {
      total: debatesNeedingAssessment.length,
      processed: 0,
      errors: [] as Array<{ debateId: string, error: string }>,
      success: [] as Array<{ debateId: string, motion: string }>
    };

    // Process debates one by one to avoid overwhelming the system
    for (const debate of debatesNeedingAssessment) {
      try {
        console.log(`[AI Assessment] Processing debate ${debate.id}: "${debate.motion}" between ${debate.debaterA.username} vs ${debate.debaterB.username}`);
        
        // Trigger AI judging for this debate
        await judgeDebate(debate.id);
        
        results.processed++;
        results.success.push({
          debateId: debate.id,
          motion: debate.motion
        });
        
        console.log(`[AI Assessment] ✓ Successfully processed debate ${debate.id}`);
        
        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[AI Assessment] Failed to process debate ${debate.id}:`, errorMessage);
        
        results.errors.push({
          debateId: debate.id,
          error: errorMessage
        });
      }
    }

    console.log(`[AI Assessment] Completed processing. Success: ${results.success.length}, Errors: ${results.errors.length}`);

    return NextResponse.json({
      message: `AI Assessment processing completed`,
      results
    });

  } catch (error) {
    console.error("[AI Assessment] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Only allow admin users for status check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Count debates that need AI assessment
    const debatesNeedingAssessment = await db.debate.findMany({
      where: {
        status: "completed",
        phase: "completed",
        isDeleted: false,
        OR: [
          { winnerId: null },
          { judgeResults: { none: {} } }
        ]
      },
      select: {
        id: true,
        motion: true,
        debaterA: { select: { username: true } },
        debaterB: { select: { username: true } },
        completedAt: true,
        judgeResults: { select: { id: true } },
        winnerId: true
      },
      orderBy: { completedAt: 'asc' }
    });

    return NextResponse.json({
      count: debatesNeedingAssessment.length,
      debates: debatesNeedingAssessment.map(d => ({
        id: d.id,
        motion: d.motion,
        debaters: `${d.debaterA.username} vs ${d.debaterB.username}`,
        completedAt: d.completedAt,
        hasWinner: !!d.winnerId,
        hasJudgeResults: d.judgeResults.length > 0
      }))
    });

  } catch (error) {
    console.error("[AI Assessment Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}