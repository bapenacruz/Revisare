import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;

  if (!session || role !== "admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-12 flex items-center gap-6 text-sm">
          <span className="font-semibold text-foreground-muted uppercase tracking-wide text-xs">
            Admin
          </span>
          {[
            { href: "/admin", label: "Dashboard" },
            { href: "/admin/flags", label: "Flags" },
            { href: "/admin/users", label: "Users" },
            { href: "/admin/debates", label: "Debates" },
            { href: "/admin/categories", label: "Categories" },
            { href: "/admin/judge-prompts", label: "Judge Prompts" },
            { href: "/admin/contact", label: "Contact" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-foreground-muted hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">{children}</div>
    </div>
  );
}
