"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import Pusher from "pusher-js";

interface Props {
  userId: string;
}

export function NotificationBell({ userId }: Props) {
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/notifications?unread=true")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setUnread(d.unreadCount); });

    const interval = setInterval(() => {
      fetch("/api/notifications?unread=true")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setUnread(d.unreadCount); });
    }, 30_000);

    const ablyKey = process.env.NEXT_PUBLIC_ABLY_KEY;
    if (ablyKey) {
      const p = new Pusher(ablyKey, {
        wsHost: "realtime-pusher.ably.io",
        httpHost: "realtime-pusher.ably.io",
        disableStats: true,
        enabledTransports: ["ws"],
        cluster: "us2", // required by pusher-js even when using a custom host
      });
      const ch = p.subscribe(`user-${userId}`);
      ch.bind("notification:new", () => {
        setUnread((c) => c + 1);
      });
      return () => {
        clearInterval(interval);
        p.disconnect();
      };
    }
    return () => clearInterval(interval);
  }, [userId]);

  // When we navigate away from notifications page, reset badge
  useEffect(() => {
    if (pathname !== "/notifications") return;
    setUnread(0);
  }, [pathname]);

  function handleClick() {
    if (pathname === "/notifications") {
      setUnread(0);
      router.refresh();
    } else {
      router.push("/notifications");
    }
  }

  return (
    <button
      onClick={handleClick}
      className="relative w-9 h-9 rounded-[--radius] flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors"
      aria-label="Notifications"
    >
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-brand text-white text-[9px] font-bold leading-none">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
