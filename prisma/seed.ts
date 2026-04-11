/**
 * Seed script: run with `npx prisma db seed`
 * or `npx tsx prisma/seed.ts`
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CATEGORY_SEEDS = [
  { slug: "politics",             label: "Politics",                emoji: "🏛️", description: "Power, policy, and the direction of society",              order: 1 },
  { slug: "science-tech",         label: "Science & Technology",    emoji: "🔬", description: "Innovation, discovery, and the future we're building",      order: 2 },
  { slug: "philosophy",           label: "Philosophy",              emoji: "🧠", description: "Ethics, logic, and life's biggest questions",               order: 3 },
  { slug: "religion",             label: "Religion",                emoji: "✝️", description: "Belief, faith, and the meaning of existence",               order: 4 },
  { slug: "economics",            label: "Economics",               emoji: "📈", description: "Money, markets, and how the world works",                   order: 5 },
  { slug: "society",              label: "Society",                 emoji: "🌍", description: "Culture, norms, and how we live together",                  order: 6 },
  { slug: "sports",               label: "Sports",                  emoji: "⚽", description: "Competition, performance, and the games we love",           order: 7 },
  { slug: "history",              label: "History",                 emoji: "📜", description: "The past, its lessons, and its impact today",               order: 8 },
  { slug: "environment",          label: "Environment",             emoji: "🌿", description: "Climate, sustainability, and our planet's future",          order: 9 },
  { slug: "culture-entertainment",label: "Culture & Entertainment", emoji: "🎬", description: "Movies, music, games, and what we consume",                order: 10 },
  { slug: "law-justice",          label: "Law & Justice",           emoji: "⚖️", description: "Rights, rules, and what's fair",                           order: 11 },
  { slug: "health-lifestyle",     label: "Health & Lifestyle",      emoji: "🏃", description: "Well-being, habits, and how we live day to day",           order: 12 },
];

/**
 * House / exhibition debaters
 * Clearly labeled isExhibition=true; must never be presented as real humans.
 * Each has a distinct debating personality and style.
 */
const EXHIBITION_USERS = [
  {
    username: "axiom_prime",
    email: "exhibition-axiom@arguably.app",
    bio: "Logic-first, classical formal argumentation. Syllogisms and structured deduction. [Platform Exhibition Account — not a real person]",
    isExhibition: true,
    role: "exhibition",
  },
  {
    username: "nova_rhetor",
    email: "exhibition-nova@arguably.app",
    bio: "Empathy-driven, humanist framing. Grounds every argument in real-world human impact. [Platform Exhibition Account — not a real person]",
    isExhibition: true,
    role: "exhibition",
  },
  {
    username: "dialectica_x",
    email: "exhibition-dialectica@arguably.app",
    bio: "Socratic interrogation style — challenges premises before building a counter-case. [Platform Exhibition Account — not a real person]",
    isExhibition: true,
    role: "exhibition",
  },
  {
    username: "evidence_forge",
    email: "exhibition-eforge@arguably.app",
    bio: "Data-heavy, citation-forward debater. Focuses on empirical evidence and peer-reviewed research. [Platform Exhibition Account — not a real person]",
    isExhibition: true,
    role: "exhibition",
  },
  {
    username: "contrarian_unit",
    email: "exhibition-contrarian@arguably.app",
    bio: "Devil's advocate persona. Takes the less popular position and argues it rigorously. [Platform Exhibition Account — not a real person]",
    isExhibition: true,
    role: "exhibition",
  },
];

async function main() {
  console.log("🌱 Seeding database…");

  // Upsert categories
  for (const cat of CATEGORY_SEEDS) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log(`✅ Seeded ${CATEGORY_SEEDS.length} categories`);

  // Upsert exhibition users
  for (const u of EXHIBITION_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { bio: u.bio, isExhibition: u.isExhibition, role: u.role },
      create: {
        email: u.email,
        username: u.username,
        bio: u.bio,
        isExhibition: u.isExhibition,
        role: u.role,
        // No password — exhibition accounts can only be used internally
        hashedPassword: null,
      },
    });
  }
  console.log(`✅ Seeded ${EXHIBITION_USERS.length} exhibition accounts`);

  // Demo user (dev only)
  if (process.env.NODE_ENV !== "production") {
    const hashedPassword = await bcrypt.hash("Password123!", 12);
    await prisma.user.upsert({
      where: { email: "demo@arguably.app" },
      update: {},
      create: {
        email: "demo@arguably.app",
        username: "demo_user",
        hashedPassword,
        bio: "Demo account for testing.",
        country: "United States",
      },
    });
    console.log("✅ Seeded demo user: demo@arguably.app / Password123!");

    // Admin account (dev only)
    const adminHash = await bcrypt.hash("AdminPass123!", 12);
    await prisma.user.upsert({
      where: { email: "admin@arguably.app" },
      update: { role: "admin" },
      create: {
        email: "admin@arguably.app",
        username: "platform_admin",
        hashedPassword: adminHash,
        role: "admin",
        bio: "Platform administrator account.",
      },
    });
    console.log("✅ Seeded admin user: admin@arguably.app / AdminPass123!");
  }

  console.log("🎉 Seeding complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
