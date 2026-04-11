#!/usr/bin/env tsx
/**
 * Script to automatically trigger AI assessment for all completed debates that don't have judge results yet.
 * This includes debates uploaded via admin dashboard import or any other completed debates missing AI assessment.
 * 
 * Usage:
 *   npx tsx scripts/trigger-ai-assessments.ts
 *   
 * Options:
 *   --limit N    Process only N debates (default: no limit)
 *   --dry-run    Show debates that need assessment but don't process them
 *   --verbose    Show detailed progress information
 */

import { db } from "@/lib/db";
import { judgeDebate } from "@/lib/judging";

interface Args {
  limit?: number;
  dryRun: boolean;
  verbose: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--verbose") {
      result.verbose = true;
    } else if (arg === "--limit" && i + 1 < args.length) {
      const limit = parseInt(args[i + 1], 10);
      if (isNaN(limit) || limit <= 0) {
        console.error("Error: --limit must be a positive number");
        process.exit(1);
      }
      result.limit = limit;
      i++; // Skip next argument as it's the limit value
    } else if (arg.startsWith("--")) {
      console.error(`Error: Unknown option ${arg}`);
      console.error("Usage: npx tsx scripts/trigger-ai-assessments.ts [--dry-run] [--verbose] [--limit N]");
      process.exit(1);
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();
  
  console.log("🔍 Finding debates that need AI assessment...");

  // Find all completed debates that need AI assessment
  const query = {
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
      winnerId: true,
      createdAt: true,
    },
    orderBy: { completedAt: 'asc' as const },
    ...(args.limit && { take: args.limit })
  };

  const debatesNeedingAssessment = await db.debate.findMany(query);

  console.log(`📊 Found ${debatesNeedingAssessment.length} debates needing AI assessment`);

  if (debatesNeedingAssessment.length === 0) {
    console.log("✅ All completed debates already have AI assessments!");
    return;
  }

  if (args.verbose || args.dryRun) {
    console.log("\nDebates needing assessment:");
    debatesNeedingAssessment.forEach((debate, index) => {
      const status = !debate.winnerId ? "No winner" : "No judge results";
      const completedDaysAgo = Math.floor(
        (Date.now() - new Date(debate.completedAt!).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      console.log(
        `${String(index + 1).padStart(3)}. [${status}] ${debate.debaterA.username} vs ${debate.debaterB.username}`
      );
      console.log(`     "${debate.motion.substring(0, 60)}${debate.motion.length > 60 ? "..." : ""}"`);
      console.log(`     Completed ${completedDaysAgo} days ago`);
    });
  }

  if (args.dryRun) {
    console.log(`\n🧪 Dry run complete. Would process ${debatesNeedingAssessment.length} debates.`);
    console.log("Run without --dry-run to actually trigger AI assessments.");
    return;
  }

  console.log(`\n🚀 Starting AI assessment for ${debatesNeedingAssessment.length} debates...`);
  console.log("⚠️  This may take several minutes. Press Ctrl+C to cancel.\n");

  // Wait 3 seconds to allow user to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));

  const results = {
    processed: 0,
    success: 0,
    errors: [] as Array<{ debateId: string; error: string; motion: string }>
  };

  // Process debates one by one to avoid overwhelming the system
  for (let i = 0; i < debatesNeedingAssessment.length; i++) {
    const debate = debatesNeedingAssessment[i];
    const progress = `[${i + 1}/${debatesNeedingAssessment.length}]`;
    
    try {
      if (args.verbose) {
        console.log(`${progress} Processing: ${debate.debaterA.username} vs ${debate.debaterB.username}`);
        console.log(`     "${debate.motion}"`);
      } else {
        process.stdout.write(`${progress} Processing debate ${debate.id}... `);
      }
      
      // Trigger AI judging for this debate
      await judgeDebate(debate.id);
      
      results.processed++;
      results.success++;
      
      if (args.verbose) {
        console.log(`     ✅ Success`);
      } else {
        console.log("✅");
      }
      
      // Small delay to prevent rate limiting and be gentle on the AI APIs
      if (i < debatesNeedingAssessment.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      results.processed++;
      results.errors.push({
        debateId: debate.id,
        error: errorMessage,
        motion: debate.motion
      });
      
      if (args.verbose) {
        console.log(`     ❌ Error: ${errorMessage}`);
      } else {
        console.log(`❌ Error: ${errorMessage}`);
      }
    }
  }

  // Final summary
  console.log(`\n🎯 Processing completed`);
  console.log(`   Total processed: ${results.processed}`);
  console.log(`   ✅ Successful: ${results.success}`);
  console.log(`   ❌ Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log(`\nErrors encountered:`);
    results.errors.forEach((err, i) => {
      console.log(`${i + 1}. Debate ${err.debateId}: ${err.error}`);
      console.log(`   Motion: "${err.motion.substring(0, 80)}${err.motion.length > 80 ? "..." : ""}"`);
    });
    
    console.log(`\n💡 Tip: You can use the admin dashboard AI Assessment tool to retry failed debates.`);
  }

  if (results.success > 0) {
    console.log(`\n✨ Successfully triggered AI assessment for ${results.success} debates!`);
  }
}

// Run the script
main()
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });