"use client";

import {
  SessionProvider as NextAuthSessionProvider,
  useSession as useNextAuthSession,
} from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}

/**
 * Safe wrapper around next-auth's useSession.
 * Falls back to { data: null, status: "loading" } during HMR / first render
 * before the SessionProvider context is established, preventing the
 * "must be wrapped in a <SessionProvider />" dev error.
 */
export function useSession() {
  try {
    return useNextAuthSession();
  } catch {
    return { data: null, status: "loading" as const, update: async () => null };
  }
}
