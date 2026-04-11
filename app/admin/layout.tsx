import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;

  if (!session || role !== "admin") {
    redirect("/");
  }

  const [pendingFlags, unreadContact] = await Promise.all([
    db.integrityFlag.count({ where: { status: "pending" } }),
    db.contactMessage.count({ where: { status: "unread" } }),
  ]);

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/flags", label: "Flags", badge: pendingFlags },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/debates", label: "Debates" },
    { href: "/admin/categories", label: "Categories" },
    { href: "/admin/judge-prompts", label: "Prompts" },
    { href: "/admin/contact", label: "Contact", badge: unreadContact },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative text-foreground-muted hover:text-foreground transition-colors"
            >
              {link.label}
              {!!link.badge && (
                <span className="absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {link.badge > 99 ? "99+" : link.badge}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">{children}</div>
    </div>
  );
}
