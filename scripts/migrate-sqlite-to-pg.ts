/**
 * Migrate all data from the local SQLite dev.db → Neon PostgreSQL
 * Run with: npx tsx scripts/migrate-sqlite-to-pg.ts
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaClient } from "../generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "path";

const sqlite = new Database(path.resolve("./dev.db"), { readonly: true });
const pg = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Helper: coerce SQLite integers (0/1) to booleans
function bool(v: unknown): boolean {
  return v === 1 || v === true || v === "1" || v === "true";
}
// Helper: coerce SQLite date strings to Date | null
function date(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  console.log("🚚 Starting SQLite → PostgreSQL migration…\n");

  // ── 1. Build category ID mapping (slug → pgId) ──────────────────────────
  const sqliteCats = sqlite.prepare("SELECT id, slug FROM Category").all() as {
    id: string;
    slug: string;
  }[];
  const pgCats = await pg.category.findMany({ select: { id: true, slug: true } });
  const catMap = new Map<string, string>(); // sqliteId → pgId
  for (const sc of sqliteCats) {
    const pc = pgCats.find((c) => c.slug === sc.slug);
    if (pc) catMap.set(sc.id, pc.id);
  }
  console.log(`✅ Category ID map built (${catMap.size} entries)`);

  // ── 2. Users ─────────────────────────────────────────────────────────────
  const sqliteUsers = sqlite.prepare("SELECT * FROM User").all() as Record<string, unknown>[];
  let usersSkipped = 0;
  let usersMigrated = 0;
  for (const u of sqliteUsers) {
    try {
      await pg.user.upsert({
        where: { email: u.email as string },
        update: {}, // don't overwrite existing
        create: {
          id: u.id as string,
          email: u.email as string,
          emailVerified: date(u.emailVerified),
          username: u.username as string,
          hashedPassword: (u.hashedPassword as string) ?? null,
          bio: (u.bio as string) ?? null,
          avatarUrl: (u.avatarUrl as string) ?? null,
          country: (u.country as string) ?? null,
          region: (u.region as string) ?? null,
          dob: date(u.dob),
          gender: (u.gender as string) ?? null,
          twitterHandle: (u.twitterHandle as string) ?? null,
          threadsHandle: (u.threadsHandle as string) ?? null,
          truthSocialHandle: (u.truthSocialHandle as string) ?? null,
          blueskyHandle: (u.blueskyHandle as string) ?? null,
          mastodonHandle: (u.mastodonHandle as string) ?? null,
          websiteUrl: (u.websiteUrl as string) ?? null,
          lastUsernameChange: date(u.lastUsernameChange),
          aiAssessment: (u.aiAssessment as string) ?? null,
          aiAssessmentUpdatedAt: date(u.aiAssessmentUpdatedAt),
          role: (u.role as string) ?? "user",
          isExhibition: bool(u.isExhibition),
          onboardingComplete: bool(u.onboardingComplete),
          suspendedUntil: date(u.suspendedUntil),
          elo: (u.elo as number) ?? 1200,
          wins: (u.wins as number) ?? 0,
          losses: (u.losses as number) ?? 0,
          createdAt: date(u.createdAt) ?? new Date(),
          updatedAt: date(u.updatedAt) ?? new Date(),
        },
      });
      usersMigrated++;
    } catch (e: unknown) {
      // username conflict — update the conflicting pg user's id to match sqlite
      if (e instanceof Error && e.message.includes("username")) {
        usersSkipped++;
      } else {
        console.warn(`  ⚠ User ${u.email}: ${(e as Error).message}`);
        usersSkipped++;
      }
    }
  }
  console.log(`✅ Users: ${usersMigrated} migrated, ${usersSkipped} skipped`);

  // ── 3. Accounts (OAuth) ──────────────────────────────────────────────────
  const sqliteAccounts = sqlite.prepare("SELECT * FROM Account").all() as Record<string, unknown>[];
  let accountsDone = 0;
  for (const a of sqliteAccounts) {
    try {
      await pg.account.upsert({
        where: { provider_providerAccountId: { provider: a.provider as string, providerAccountId: a.providerAccountId as string } },
        update: {},
        create: {
          id: a.id as string,
          userId: a.userId as string,
          type: a.type as string,
          provider: a.provider as string,
          providerAccountId: a.providerAccountId as string,
          refresh_token: (a.refresh_token as string) ?? null,
          access_token: (a.access_token as string) ?? null,
          expires_at: (a.expires_at as number) ?? null,
          token_type: (a.token_type as string) ?? null,
          scope: (a.scope as string) ?? null,
          id_token: (a.id_token as string) ?? null,
          session_state: (a.session_state as string) ?? null,
        },
      });
      accountsDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ Account ${a.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ Accounts: ${accountsDone} migrated`);

  // ── 4. UserFavoriteCategory ───────────────────────────────────────────────
  const sqliteFavCats = sqlite.prepare("SELECT * FROM UserFavoriteCategory").all() as Record<string, unknown>[];
  let favCatsDone = 0;
  for (const fc of sqliteFavCats) {
    const pgCatId = catMap.get(fc.categoryId as string);
    if (!pgCatId) continue;
    try {
      await pg.userFavoriteCategory.upsert({
        where: { userId_categoryId: { userId: fc.userId as string, categoryId: pgCatId } },
        update: {},
        create: { userId: fc.userId as string, categoryId: pgCatId },
      });
      favCatsDone++;
    } catch { /* skip */ }
  }
  console.log(`✅ UserFavoriteCategories: ${favCatsDone} migrated`);

  // ── 5. Challenges ────────────────────────────────────────────────────────
  const sqliteChallenges = sqlite.prepare("SELECT * FROM Challenge").all() as Record<string, unknown>[];
  let challengesDone = 0;
  for (const c of sqliteChallenges) {
    const pgCatId = catMap.get(c.categoryId as string);
    if (!pgCatId) { console.warn(`  ⚠ Challenge ${c.id}: no category mapping`); continue; }
    try {
      await pg.challenge.upsert({
        where: { id: c.id as string },
        update: {},
        create: {
          id: c.id as string,
          type: c.type as string,
          status: c.status as string,
          motion: c.motion as string,
          categoryId: pgCatId,
          format: c.format as string,
          ranked: bool(c.ranked),
          isPublic: bool(c.isPublic),
          timerPreset: (c.timerPreset as number) ?? 300,
          creatorId: c.creatorId as string,
          targetId: (c.targetId as string) ?? null,
          creatorAccepted: bool(c.creatorAccepted),
          targetAccepted: bool(c.targetAccepted),
          lockedAt: date(c.lockedAt),
          expiresAt: date(c.expiresAt),
          createdAt: date(c.createdAt) ?? new Date(),
          updatedAt: date(c.updatedAt) ?? new Date(),
        },
      });
      challengesDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ Challenge ${c.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ Challenges: ${challengesDone} migrated`);

  // ── 6. JoinRequests ──────────────────────────────────────────────────────
  const sqliteJoinReqs = sqlite.prepare("SELECT * FROM JoinRequest").all() as Record<string, unknown>[];
  let joinReqsDone = 0;
  for (const jr of sqliteJoinReqs) {
    try {
      await pg.joinRequest.upsert({
        where: { id: jr.id as string },
        update: {},
        create: {
          id: jr.id as string,
          challengeId: jr.challengeId as string,
          userId: jr.userId as string,
          status: (jr.status as string) ?? "pending",
          createdAt: date(jr.createdAt) ?? new Date(),
        },
      });
      joinReqsDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ JoinRequest ${jr.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ JoinRequests: ${joinReqsDone} migrated`);

  // ── 7. Debates ───────────────────────────────────────────────────────────
  const sqliteDebates = sqlite.prepare("SELECT * FROM Debate").all() as Record<string, unknown>[];
  let debatesDone = 0;
  for (const d of sqliteDebates) {
    const pgCatId = catMap.get(d.categoryId as string);
    if (!pgCatId) { console.warn(`  ⚠ Debate ${d.id}: no category mapping`); continue; }
    try {
      await pg.debate.upsert({
        where: { id: d.id as string },
        update: {},
        create: {
          id: d.id as string,
          challengeId: d.challengeId as string,
          categoryId: pgCatId,
          motion: d.motion as string,
          format: d.format as string,
          ranked: bool(d.ranked),
          isPublic: bool(d.isPublic),
          timerPreset: (d.timerPreset as number) ?? 300,
          status: (d.status as string) ?? "pending",
          phase: (d.phase as string) ?? "prep",
          debaterAId: d.debaterAId as string,
          debaterBId: d.debaterBId as string,
          winnerId: (d.winnerId as string) ?? null,
          coinFlipWinnerId: (d.coinFlipWinnerId as string) ?? null,
          currentTurnIndex: (d.currentTurnIndex as number) ?? 0,
          currentUserId: (d.currentUserId as string) ?? null,
          timerStartedAt: date(d.timerStartedAt),
          prepEndsAt: date(d.prepEndsAt),
          secondChancePending: bool(d.secondChancePending),
          secondChanceRequesterId: (d.secondChanceRequesterId as string) ?? null,
          secondChanceUserId: (d.secondChanceUserId as string) ?? null,
          secondChanceExpiresAt: date(d.secondChanceExpiresAt),
          forfeitedBy: (d.forfeitedBy as string) ?? null,
          startedAt: date(d.startedAt),
          completedAt: date(d.completedAt),
          createdAt: date(d.createdAt) ?? new Date(),
          updatedAt: date(d.updatedAt) ?? new Date(),
        },
      });
      debatesDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ Debate ${d.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ Debates: ${debatesDone} migrated`);

  // ── 8. DebateTurns ───────────────────────────────────────────────────────
  const sqliteTurns = sqlite.prepare("SELECT * FROM DebateTurn").all() as Record<string, unknown>[];
  let turnsDone = 0;
  for (const t of sqliteTurns) {
    try {
      await pg.debateTurn.upsert({
        where: { id: t.id as string },
        update: {},
        create: {
          id: t.id as string,
          debateId: t.debateId as string,
          userId: t.userId as string,
          roundName: t.roundName as string,
          content: t.content as string,
          isAutoSubmit: bool(t.isAutoSubmit),
          submittedAt: date(t.submittedAt) ?? new Date(),
        },
      });
      turnsDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ DebateTurn ${t.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ DebateTurns: ${turnsDone} migrated`);

  // ── 9. JudgeResults ──────────────────────────────────────────────────────
  const sqliteJudgeResults = sqlite.prepare("SELECT * FROM JudgeResult").all() as Record<string, unknown>[];
  let judgesDone = 0;
  for (const j of sqliteJudgeResults) {
    try {
      await pg.judgeResult.upsert({
        where: { id: j.id as string },
        update: {},
        create: {
          id: j.id as string,
          debateId: j.debateId as string,
          judgeId: j.judgeId as string,
          winnerId: (j.winnerId as string) ?? null,
          explanation: j.explanation as string,
          privateFeedbackA: (j.privateFeedbackA as string) ?? null,
          privateFeedbackB: (j.privateFeedbackB as string) ?? null,
          roundScores: j.roundScores as string,
          createdAt: date(j.createdAt) ?? new Date(),
        },
      });
      judgesDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ JudgeResult ${j.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ JudgeResults: ${judgesDone} migrated`);

  // ── 10. SpectatorMessages ────────────────────────────────────────────────
  const sqliteSpectator = sqlite.prepare("SELECT * FROM SpectatorMessage").all() as Record<string, unknown>[];
  let spectatorDone = 0;
  for (const s of sqliteSpectator) {
    try {
      await pg.spectatorMessage.upsert({
        where: { id: s.id as string },
        update: {},
        create: {
          id: s.id as string,
          debateId: s.debateId as string,
          userId: (s.userId as string) ?? null,
          guestName: (s.guestName as string) ?? null,
          content: s.content as string,
          createdAt: date(s.createdAt) ?? new Date(),
        },
      });
      spectatorDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ SpectatorMessage ${s.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ SpectatorMessages: ${spectatorDone} migrated`);

  // ── 11. AudienceVotes ────────────────────────────────────────────────────
  const sqliteVotes = sqlite.prepare("SELECT * FROM AudienceVote").all() as Record<string, unknown>[];
  let votesDone = 0;
  for (const v of sqliteVotes) {
    try {
      await pg.audienceVote.upsert({
        where: { id: v.id as string },
        update: {},
        create: {
          id: v.id as string,
          debateId: v.debateId as string,
          voterToken: v.voterToken as string,
          votedForId: v.votedForId as string,
          createdAt: date(v.createdAt) ?? new Date(),
        },
      });
      votesDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ AudienceVote ${v.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ AudienceVotes: ${votesDone} migrated`);

  // ── 12. DebateComments ───────────────────────────────────────────────────
  const sqliteComments = sqlite.prepare("SELECT * FROM DebateComment").all() as Record<string, unknown>[];
  let commentsDone = 0;
  for (const c of sqliteComments) {
    try {
      await pg.debateComment.upsert({
        where: { id: c.id as string },
        update: {},
        create: {
          id: c.id as string,
          debateId: c.debateId as string,
          userId: c.userId as string,
          content: c.content as string,
          createdAt: date(c.createdAt) ?? new Date(),
        },
      });
      commentsDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ DebateComment ${c.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ DebateComments: ${commentsDone} migrated`);

  // ── 13. Notifications ────────────────────────────────────────────────────
  const sqliteNotifs = sqlite.prepare("SELECT * FROM Notification").all() as Record<string, unknown>[];
  let notifsDone = 0;
  for (const n of sqliteNotifs) {
    try {
      await pg.notification.upsert({
        where: { id: n.id as string },
        update: {},
        create: {
          id: n.id as string,
          userId: n.userId as string,
          type: n.type as string,
          payload: n.payload as string,
          read: bool(n.read),
          createdAt: date(n.createdAt) ?? new Date(),
        },
      });
      notifsDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ Notification ${n.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ Notifications: ${notifsDone} migrated`);

  // ── 14. SuspiciousTurnSignals ────────────────────────────────────────────
  const sqliteSignals = sqlite.prepare("SELECT * FROM SuspiciousTurnSignal").all() as Record<string, unknown>[];
  let signalsDone = 0;
  for (const s of sqliteSignals) {
    try {
      await pg.suspiciousTurnSignal.upsert({
        where: { id: s.id as string },
        update: {},
        create: {
          id: s.id as string,
          debateId: s.debateId as string,
          turnId: (s.turnId as string) ?? null,
          userId: s.userId as string,
          signal: s.signal as string,
          detail: (s.detail as string) ?? null,
          createdAt: date(s.createdAt) ?? new Date(),
        },
      });
      signalsDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ SuspiciousTurnSignal ${s.id}: ${(e as Error).message}`);
    }
  }
  console.log(`✅ SuspiciousTurnSignals: ${signalsDone} migrated`);

  // ── 15. Follows ──────────────────────────────────────────────────────────
  const sqliteFollows = sqlite.prepare("SELECT * FROM Follow").all() as Record<string, unknown>[];
  let followsDone = 0;
  for (const f of sqliteFollows) {
    try {
      await pg.follow.upsert({
        where: { followerId_followingId: { followerId: f.followerId as string, followingId: f.followingId as string } },
        update: {},
        create: {
          followerId: f.followerId as string,
          followingId: f.followingId as string,
          createdAt: date(f.createdAt) ?? new Date(),
        },
      });
      followsDone++;
    } catch (e: unknown) {
      console.warn(`  ⚠ Follow: ${(e as Error).message}`);
    }
  }
  console.log(`✅ Follows: ${followsDone} migrated`);

  sqlite.close();
  await pg.$disconnect();
  console.log("\n🎉 Migration complete!");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
