#!/usr/bin/env tsx
/**
 * Script to recalculate user wins/losses based on actual debate results.
 * This fixes the leaderboard corruption caused by the duplicate wins/losses bug during re-judging.
 * 
 * Usage:
 *   npx tsx scripts/fix-leaderboard-stats.ts
 *   
 * Options:
 *   --dry-run    Show what would be changed but don't update database
 *   --user ID    Fix stats for a specific user only
 */

import { db } from "@/lib/db";

interface Args {
  dryRun: boolean;
  userId?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--user" && i + 1 < args.length) {
      result.userId = args[i + 1];
      i++; // Skip next argument as it's the user ID
    } else if (arg.startsWith("--")) {
      console.error(`Error: Unknown option ${arg}`);
      console.error("Usage: npx tsx scripts/fix-leaderboard-stats.ts [--dry-run] [--user ID]");
      process.exit(1);
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();
  
  console.log("🔍 Recalculating user wins/losses from actual debate results...\n");

  // Get query for users to fix
  const userQuery = args.userId 
    ? { where: { id: args.userId } }
    : { where: { isDeleted: false } };

  const users = await db.user.findMany({
    ...userQuery,
    select: {
      id: true,
      username: true,
      wins: true,
      losses: true,
      rankedDebatesPlayed: true,
    }
  });

  console.log(`📊 Found ${users.length} users to check\n`);

  const results = {
    usersFixed: 0,
    totalWinsDiff: 0,
    totalLossesDiff: 0,
    errors: [] as Array<{ userId: string; error: string }>
  };

  for (const user of users) {
    try {
      // Get actual wins/losses from completed debates (non-deleted, including hidden)
      const actualWins = await db.debate.count({
        where: {
          winnerId: user.id,
          status: "completed",
          phase: "completed",
          isDeleted: false, // Include hidden debates, exclude deleted ones
          ranked: true // Only count ranked debates for stats
        }
      });

      const actualLosses = await db.debate.count({
        where: {
          OR: [
            { debaterAId: user.id },
            { debaterBId: user.id }
          ],
          status: "completed",
          phase: "completed",
          isDeleted: false,
          ranked: true,
          winnerId: { not: null }, // There is a winner
          winnerId: { not: user.id } // And it's not this user
        }
      });

      const actualRankedDebates = await db.debate.count({
        where: {
          OR: [
            { debaterAId: user.id },
            { debaterBId: user.id }
          ],
          status: "completed",
          phase: "completed", 
          isDeleted: false,
          ranked: true
        }
      });

      // Check if correction is needed
      const winsDiff = actualWins - user.wins;
      const lossesDiff = actualLosses - user.losses;
      const rankedDiff = actualRankedDebates - user.rankedDebatesPlayed;

      if (winsDiff !== 0 || lossesDiff !== 0 || rankedDiff !== 0) {
        console.log(`👤 ${user.username}:`);\n        console.log(`   Current: ${user.wins}W/${user.losses}L (${user.rankedDebatesPlayed} ranked)`);\n        console.log(`   Actual:  ${actualWins}W/${actualLosses}L (${actualRankedDebates} ranked)`);\n        console.log(`   Diff:    ${winsDiff > 0 ? '+' : ''}${winsDiff}W/${lossesDiff > 0 ? '+' : ''}${lossesDiff}L (${rankedDiff > 0 ? '+' : ''}${rankedDiff} ranked)`);\n\n        if (!args.dryRun) {\n          await db.user.update({\n            where: { id: user.id },\n            data: {\n              wins: actualWins,\n              losses: actualLosses,\n              rankedDebatesPlayed: actualRankedDebates\n            }\n          });\n          console.log(`   ✅ Fixed`);\n        } else {\n          console.log(`   🧪 Would fix (dry run)`);\n        }\n\n        results.usersFixed++;\n        results.totalWinsDiff += winsDiff;\n        results.totalLossesDiff += lossesDiff;\n        console.log();\n      }\n\n    } catch (error) {\n      const errorMessage = error instanceof Error ? error.message : 'Unknown error';\n      results.errors.push({\n        userId: user.id,\n        error: errorMessage\n      });\n      console.log(`❌ Error processing user ${user.username}: ${errorMessage}`);\n    }\n  }\n\n  // Final summary\n  console.log(`🎯 Leaderboard correction ${args.dryRun ? 'analysis' : 'completed'}`);\n  console.log(`   Users needing fixes: ${results.usersFixed}`);\n  console.log(`   Total wins adjustment: ${results.totalWinsDiff > 0 ? '+' : ''}${results.totalWinsDiff}`);\n  console.log(`   Total losses adjustment: ${results.totalLossesDiff > 0 ? '+' : ''}${results.totalLossesDiff}`);\n\n  if (results.errors.length > 0) {\n    console.log(`\\n❌ Errors encountered: ${results.errors.length}`);\n    results.errors.forEach((err, i) => {\n      console.log(`${i + 1}. User ${err.userId}: ${err.error}`);\n    });\n  }\n\n  if (args.dryRun && results.usersFixed > 0) {\n    console.log(`\\n💡 Run without --dry-run to apply these fixes.`);\n  } else if (!args.dryRun && results.usersFixed > 0) {\n    console.log(`\\n✨ Successfully corrected leaderboard data for ${results.usersFixed} users!`);\n  } else {\n    console.log(`\\n✅ All user statistics are already correct!`);\n  }\n}\n\n// Run the script\nmain()\n  .catch((error) => {\n    console.error(\"💥 Script failed:\", error);\n    process.exit(1);\n  })\n  .finally(async () => {\n    await db.$disconnect();\n  });