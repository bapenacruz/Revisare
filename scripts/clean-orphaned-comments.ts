import { PrismaClient } from "../generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });
async function main() {
  const del = await db.debateComment.deleteMany({ where: { debate: { isDeleted: true } } });
  console.log("Deleted orphaned comments:", del.count);
  const delSub = await db.debateCommentSubscription.deleteMany({ where: { debate: { isDeleted: true } } });
  console.log("Deleted orphaned subscriptions:", delSub.count);
  await db.$disconnect();
}
main().catch(console.error);
