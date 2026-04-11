"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useSession } from "@/components/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { User, Swords, ShieldCheck, Info, LogOut, Smartphone, Apple, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useState } from "react";

function InstallSection() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => { setOpen(v => !v); setPlatform(null); }}
        className="w-full flex items-center justify-between px-6 py-4 text-base text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors"
      >
        <span className="flex items-center gap-3">
          <Smartphone size={18} />
          Install App
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-6 pb-4">
          {platform === null ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setPlatform("android")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[--radius] text-sm text-foreground-muted hover:text-foreground hover:bg-surface-raised border border-border transition-colors"
              >
                <Smartphone size={16} />
                Android
              </button>
              <button
                onClick={() => setPlatform("ios")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[--radius] text-sm text-foreground-muted hover:text-foreground hover:bg-surface-raised border border-border transition-colors"
              >
                <Apple size={16} />
                iOS
              </button>
            </div>
          ) : (
            <div className="rounded-[--radius] bg-surface-raised border border-border px-4 py-3 text-sm text-foreground-muted space-y-2">
              <button onClick={() => setPlatform(null)} className="text-brand hover:underline flex items-center gap-1 mb-2">
                <ChevronDown size={12} className="rotate-90" /> Back
              </button>
              {platform === "android" ? (
                <>
                  <p className="font-semibold text-foreground">Install on Android</p>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>Open Revisare in <strong>Chrome</strong></li>
                    <li>Tap the <strong>⋮ menu</strong> (top-right)</li>
                    <li>Select <strong>"Add to Home screen"</strong></li>
                    <li>Tap <strong>Add</strong> to confirm</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">Install on iOS</p>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>Open Revisare in <strong>Safari</strong></li>
                    <li>Tap the <strong>Share</strong> button (bottom bar)</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong> — if you don&apos;t see it, tap <strong>"More"</strong> first</li>
                    <li>Tap <strong>Add</strong> to confirm</li>
                  </ol>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  if (!user) {
    router.replace("/auth/login");
    return null;
  }

  const username = (user as { username?: string }).username ?? user.name ?? "User";
  const isAdmin = (user as { role?: string }).role === "admin";

  return (
    <div className="mx-auto max-w-lg">
      {/* Profile header */}
      <div className="flex items-center gap-4 px-6 py-6 border-b border-border">
        <Avatar
          initial={username[0]?.toUpperCase() ?? "U"}
          src={user.image}
          size="lg"
        />
        <div>
          <p className="text-lg font-semibold text-foreground">{username}</p>
          <p className="text-sm text-foreground-muted">{user.email}</p>
        </div>
      </div>

      {/* Menu items */}
      <nav className="py-2">
        <Link href="/profile" className="flex items-center gap-3 px-6 py-4 text-base text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors">
          <User size={18} />
          My Profile
        </Link>
        <Link href="/challenges" className="flex items-center gap-3 px-6 py-4 text-base text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors">
          <Swords size={18} />
          My Debates
        </Link>
        {isAdmin && (
          <Link href="/admin" className="flex items-center gap-3 px-6 py-4 text-base text-brand hover:bg-surface-raised transition-colors">
            <ShieldCheck size={18} />
            Admin Panel
          </Link>
        )}
        <div className="my-2 border-t border-border" />
        <Link href="/about" className="flex items-center gap-3 px-6 py-4 text-base text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors">
          <Info size={18} />
          About
        </Link>
        <InstallSection />
        <div className="my-2 border-t border-border" />
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full flex items-center gap-3 px-6 py-4 text-base text-danger hover:bg-surface-raised transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </nav>
    </div>
  );
}
