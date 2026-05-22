import "dotenv/config";
import { db } from "../lib/db";

async function main() {
  const result = await db.user.updateMany({
    where: {
      avatarUrl: { not: null },
      OR: [
        { avatarUrl: { contains: "googleusercontent.com" } },
        { avatarUrl: { contains: "graph.microsoft.com" } },
        { avatarUrl: { contains: "login.microsoftonline.com" } },
      ],
    },
    data: { avatarUrl: null },
  });
  console.log(`Cleared ${result.count} OAuth avatar(s).`);
}

main().catch(console.error).finally(() => db.$disconnect());
