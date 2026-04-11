"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/providers/SessionProvider";
import { Bell, CheckCheck } from "lucide-react";
import { VISIBLE_NOTIFICATION_TYPES } from "@/lib/notification-types";

interface NotifPayload {
  title: string;
  body: string;
  href?: string;
  type: string;
}
interface Notif {
  id: string;
  type: string;
  payload: NotifPayload;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  new_follower: "👤",
  result_ready: "🏆",
  challenge_received: "⚔️",
  featured_debate: "⭐",
  opponent_forfeit: "🏳️",
};

const VISIBLE_TYPES = new Set<string>(VISIBLE_NOTIFICATION_TYPES);

export default function NotificationsPage() {
  const { data: session } = useSession();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d: { notifications: Notif[] }) => {
        setNotifs(d.notifications.filter((n: Notif) => VISIBLE_TYPES.has(n.type)));
        setLoading(false);
      });
  }, [session]);

  async function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", body: "{}" });
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-foreground-muted">
          <Link href="/auth/login" className="text-brand hover:underline">
            Sign in
          </Link>{" "}
          to see your notifications.
        </p>
      </div>
    );
  }

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell size={22} className="text-brand" />
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        </div>
        {notifs.length > 0 && unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="rounded-[--radius] border border-border bg-surface text-center py-16">
          <Bell size={32} className="text-foreground-subtle mx-auto mb-3" />
          <p className="text-foreground-muted">No notifications yet.</p>
          <p className="text-sm text-foreground-subtle mt-1">
            Accept challenges and complete debates to get updates here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-[--radius] border border-border overflow-hidden">
          {notifs.map((n) => {
            const icon = TYPE_ICON[n.type] ?? "🔔";
            const content = (
              <div className={`flex gap-3 px-4 py-4 transition-colors ${n.read ? "bg-surface" : "bg-brand-dim/20"}`}>
                <span className="text-xl shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {n.payload.title}
                  </p>
                  <p className="text-sm text-foreground-muted mt-0.5 leading-snug">
                    {n.payload.body}
                  </p>
                  <p className="text-xs text-foreground-subtle mt-1.5">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <span className="shrink-0 mt-1 w-2 h-2 rounded-full bg-brand" />
                )}
              </div>
            );

            return n.payload.href ? (
              <Link key={n.id} href={n.payload.href} onClick={() => markRead(n.id)} className="hover:opacity-90 block">
                {content}
              </Link>
            ) : (
              <div key={n.id} onClick={() => markRead(n.id)}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
