import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

/** Derive a username from a Google profile email prefix (everything before @).
 * Sanitizes to alphanumeric+underscore, max 20 chars.
 * Returns the base; collision deduplication happens in the GoogleProvider profile callback. */
function usernameFromEmail(email: string): string {
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 20) || "user";
}

/** Find a unique username by appending incrementing numbers if the base is taken. */
async function uniqueUsername(base: string): Promise<string> {
  const existing = await db.user.findUnique({ where: { username: base }, select: { id: true } });
  if (!existing) return base;
  for (let i = 2; i <= 999; i++) {
    const candidate = `${base.substring(0, 17)}${i}`;
    const clash = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  // Extreme fallback — shouldn't be reached
  return `${base.substring(0, 14)}${Date.now().toString().slice(-6)}`;
}

const prismaAdapter = PrismaAdapter(db as any);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: {
    ...prismaAdapter,
    // Override to ensure email lookups are always case-insensitive
    async getUserByEmail(email: string) {
      return db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      }) as any;
    },
  },

  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        // Use email prefix as base; append a short random tag so DB creation
        // never collides — `events.createUser` will clean it up immediately.
        const base = usernameFromEmail(profile.email as string);
        const tag = Math.random().toString(36).slice(2, 6);
        return {
          id: profile.sub,
          email: profile.email,
          emailVerified: profile.email_verified ? new Date() : null,
          username: `${base.substring(0, 16)}_${tag}`,
          avatarUrl: (profile.picture as string | undefined) ?? null,
        };
      },
    }),

    MicrosoftEntraId({
      clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      issuer: "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        const base = usernameFromEmail(profile.email as string);
        const tag = Math.random().toString(36).slice(2, 6);
        return {
          id: profile.oid,
          email: profile.email,
          emailVerified: null,
          username: `${base.substring(0, 16)}_${tag}`,
          avatarUrl: null,
        };
      },
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        emailOrUsername: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.emailOrUsername || !credentials?.password) return null;

        const raw = String(credentials.emailOrUsername).trim();
        const password = String(credentials.password);

        // Support login by email or username
        const isEmail = raw.includes("@");
        const user = isEmail
          ? await db.user.findUnique({ where: { email: raw.toLowerCase() } })
          : await db.user.findUnique({ where: { username: raw } });

        if (!user?.hashedPassword) return null;

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          image: user.avatarUrl ?? null,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async signIn() {
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id ?? "";
        // Fetch extra fields to include in token on sign-in
        const dbUser = await db.user.findUnique({
          where: { id: user.id! },
          select: { username: true, role: true, isExhibition: true, onboardingComplete: true },
        });
        if (dbUser) {
          token.username = dbUser.username;
          token.role = dbUser.role;
          token.isExhibition = dbUser.isExhibition;
          token.onboardingComplete = dbUser.onboardingComplete;
        }
      }
      // When update() is called from client, merge any passed data into token
      if (trigger === "update" && session) {
        if (session.onboardingComplete !== undefined) {
          token.onboardingComplete = session.onboardingComplete;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.isExhibition = token.isExhibition as boolean;
        session.user.onboardingComplete = token.onboardingComplete as boolean;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
    newUser: "/onboarding",
    error: "/auth/error",
  },

  events: {
    async createUser({ user }) {
      // Replace the temporary `base_xxxx` username with a clean deduplicated one
      if (!user.id || !user.email) return;
      const base = usernameFromEmail(user.email);
      const clean = await uniqueUsername(base);
      await db.user.update({ where: { id: user.id }, data: { username: clean } });
    },
  },
});
