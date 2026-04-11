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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          {[
            { href: "/admin", label: "Dashboard" },
            { href: "/admin/flags", label: "Flags" },
            { href: "/admin/users", label: "Users" },
            { href: "/admin/debates", label: "Debates" },
            { href: "/admin/categories", label: "Categories" },
            { href: "/admin/judge-prompts", label: "Prompts" },
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
