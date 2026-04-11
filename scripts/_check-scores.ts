import * as dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), ".env") });

import { db } from "@/lib/db";

async function main() {
  const results = await db.judgeResult.findMany({
    where: { judgeId: "consensus" },
    select: {
      id: true,
      roundScores: true,
      debate: { select: { debaterA: { select: { username: true } }, debaterB: { select: { username: true } } } },
    },
  });

  for (const r of results) {
    const parsed = r.roundScores ? JSON.parse(r.roundScores) : null;
    console.log(`\n${r.debate.debaterA.username} vs ${r.debate.debaterB.username}`);
    console.log(`  scoresA: ${parsed?.scoresA ? "✓" : "NULL"}`);
    console.log(`  scoresB: ${parsed?.scoresB ? "✓" : "NULL"}`);
    console.log(`  biggestMistakeA: ${parsed?.biggestMistakeA ? "✓" : "NULL"}`);
    console.log(`  biggestAchievementA: ${parsed?.biggestAchievementA ? "✓" : "NULL"}`);
  }
  process.exit(0);
}
main();
