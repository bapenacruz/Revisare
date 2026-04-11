import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { judgeDebate } from "@/lib/judging";

export async function POST(req: NextRequest) {
  try {
    // Only allow admin users
    const session = await auth();
    const role = (session?.user as { role?: string })?.role;
    if (!session || role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Process debates in batches of 5 to balance speed and system load
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < debatesNeedingAssessment.length; i += BATCH_SIZE) {
      const batch = debatesNeedingAssessment.slice(i, i + BATCH_SIZE);
      console.log(`[AI Assessment] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(debatesNeedingAssessment.length / BATCH_SIZE)} (${batch.length} debates)`);
      
      // Process all debates in this batch simultaneously
      const batchResults = await Promise.allSettled(
        batch.map(async (debate) => {
          console.log(`[AI Assessment] Processing debate ${debate.id}: "${debate.motion}" between ${debate.debaterA.username} vs ${debate.debaterB.username}`);
          
          try {
            await judgeDebate(debate.id);
            console.log(`[AI Assessment] ✓ Successfully processed debate ${debate.id}`);
            return {
              success: true,
              debateId: debate.id,
              motion: debate.motion
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[AI Assessment] Failed to process debate ${debate.id}:`, errorMessage);
            return {
              success: false,
              debateId: debate.id,
              error: errorMessage
            };
          }
        })
      );

      // Process batch results
      for (const result of batchResults) {
        results.processed++;
        
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.success.push({
              debateId: result.value.debateId,
              motion: result.value.motion
            });
          } else {
            results.errors.push({
              debateId: result.value.debateId,
              error: result.value.error
            });
          }
        } else {
          // Handle rejected promises (shouldn't happen with our error handling, but just in case)
          console.error(`[AI Assessment] Unexpected batch failure:`, result.reason);
        }
      }
      
      // Small delay between batches to prevent overwhelming the system
      if (i + BATCH_SIZE < debatesNeedingAssessment.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
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
    const session = await auth();
    const role = (session?.user as { role?: string })?.role;
    if (!session || role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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