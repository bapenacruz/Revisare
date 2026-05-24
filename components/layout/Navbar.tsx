"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useAvatar } from "@/components/providers/AvatarProvider";
import { Search, LogIn } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SearchModal } from "@/components/layout/SearchModal";

export function Navbar() {
  const { data: session, status } = useSession();
  const { avatarUrl } = useAvatar();
  const user = session?.user;
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/icon-180.png" alt="Revisare" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight text-foreground">Revisare</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-[--radius] hover:bg-surface-raised transition-colors text-foreground-muted hover:text-foreground"
            aria-label="Search"
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
                  src={avatarUrl ?? undefined}
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
    {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}

