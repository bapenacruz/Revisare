import type { NextAuthConfig } from "next-auth";

// Minimal Edge-compatible NextAuth config used by the middleware.
// Must NOT import Prisma, bcryptjs, or any other Node.js-only module.
// The full config (with adapter, providers, bcrypt) lives in lib/auth.ts.
export const authConfig = {
  trustHost: true,
  providers: [],
  pages: {
    signIn: "/auth/login",
    newUser: "/onboarding",
    error: "/auth/error",
  },
  callbacks: {
    session({ session, token }) {
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
} satisfies NextAuthConfig;
