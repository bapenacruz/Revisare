"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";

interface AvatarContextValue {
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
}

const AvatarContext = createContext<AvatarContextValue>({
  avatarUrl: null,
  setAvatarUrl: () => {},
});

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setAvatarUrl(null);
      return;
    }
    fetch("/api/me/avatar")
      .then((r) => r.json())
      .then((d: { avatarUrl?: string | null }) => setAvatarUrl(d.avatarUrl ?? null))
      .catch(() => {});
  }, [session?.user?.id]);

  return (
    <AvatarContext.Provider value={{ avatarUrl, setAvatarUrl }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  return useContext(AvatarContext);
}
