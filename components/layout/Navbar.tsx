"use client";

import Link from "next/link";
import { useSession } from "@/components/providers/SessionProvider";
import { Sword, Search, LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
            <Sword size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">Revisare</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/debates")}
            className="flex items-center justify-center w-9 h-9 rounded-[--radius] hover:bg-surface-raised transition-colors text-foreground-muted hover:text-foreground"
            aria-label="Search debates"
          >
            <Search size={18} />
          </button>

          {status === "loading" ? (
            <div className="w-9 h-9 rounded-[--radius] bg-surface animate-pulse" />
          ) : user ? (
            <>
              <NotificationBell userId={user.id ?? ""} />
              <Link href="/account" className="flex items-center h-9 px-2 rounded-[--radius] hover:bg-surface-raised transition-colors">
                <Avatar
                  initial={(user as { username?: string }).username?.[0]?.toUpperCase() ?? user.name?.[0]?.toUpperCase() ?? "U"}
                  src={user.image}
                  size="sm"
                />
              </Link>
            </>
          ) : (
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">
                <LogIn size={14} />
                Log in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

