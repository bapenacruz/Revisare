/**
 * seed-personas.ts
 * Creates user accounts from lib/data/personas.json.
 * Run with:  npx tsx scripts/seed-personas.ts
 *
 * Skips personas whose username or email already exists.
 */

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";

interface Persona {
  username: string;
  email: string;
  password: string;
  bio?: string;
  synthetic?: boolean;
  education_level?: string;
  writing_style_details?: {
    common_phrases: string[];
    tone: string;
    sentence_structure: string;
    formality: string;
  };
  prompt?: string;
}

async function main() {
  const personasPath = join(process.cwd(), "lib", "data", "personas.json");
  const allPersonas: Persona[] = JSON.parse(readFileSync(personasPath, "utf-8"));

  // Only seed synthetic (AI) personas — real users register via the app
  const personas = allPersonas.filter((p) => p.synthetic !== false);

  console.log(`\nSeeding ${personas.length} synthetic personas (skipping ${allPersonas.length - personas.length} real users)...\n`);

  let created = 0;
  let skipped = 0;

  for (const persona of personas) {
    const { username, email, password, bio } = persona;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.user.findFirst({
      where: { OR: [{ email: normalizedEmail }, { username }] },
      select: { username: true },
    });

    if (existing) {
      console.log(`  SKIP  ${username} (already exists as "${existing.username}")`);
      skipped++;
      continue;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        username,
        hashedPassword,
        bio: bio ?? null,
        emailVerified: new Date(), // treat as verified
      },
      select: { id: true, username: true },
    });

    console.log(`  CREATE ${user.username}  (${user.id})`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
