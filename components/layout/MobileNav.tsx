"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Trophy, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Categories", icon: LayoutGrid },
  { href: "/challenges/new", label: "Debate", icon: Plus, highlight: true },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/community", label: "Community", icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-md border-t border-border">
      <div className="mx-auto max-w-7xl w-full flex items-center justify-around h-16 px-4 sm:px-6">
        {MOBILE_LINKS.map(({ href, label, icon: Icon, highlight }) => {
          const active =
            pathname === href ||
            (href === "/explore" && pathname.startsWith("/categories"));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 min-h-[44px] h-full items-center justify-center",
                "text-foreground-muted transition-colors select-none",
                highlight && "relative"
              )}
            >
              <span className={cn(
                "flex flex-col items-center gap-0.5",
                active && !highlight && "text-brand",
              )}>
                {highlight ? (
                  <span className="w-11 h-11 rounded-full bg-brand flex items-center justify-center shadow-lg shadow-brand/30 -mt-5 border-2 border-background">
                    <Icon size={20} className="text-white" />
                  </span>
                ) : (
                  <Icon size={20} className={cn(active && "text-brand")} />
                )}
                <span className={cn("text-[10px] font-medium", highlight ? "text-brand" : active ? "text-brand" : "")}>
                  {label}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
