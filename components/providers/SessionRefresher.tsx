"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Detects a stale JWT username (e.g. after an admin rename) and refreshes the
 * session token so that the Navbar and other client components reflect the
 * current DB value immediately.
 */
export function SessionRefresher({ dbUsername }: { dbUsername: string }) {
  const { data: session, update } = useSession();

  useEffect(() => {
    const jwtUsername = (session?.user as { username?: string } | undefined)?.username;
    if (jwtUsername && jwtUsername !== dbUsername) {
      update({ username: dbUsername });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUsername]);

  return null;
}
