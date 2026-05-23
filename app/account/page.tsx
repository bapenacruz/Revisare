"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useSession } from "@/components/providers/SessionProvider";
import { useAvatar } from "@/components/providers/AvatarProvider";
import { useRouter } from "next/navigation";
import { User, Swords, ShieldCheck, Info, LogOut, Smartphone, Laptop, ChevronDown, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useState } from "react";

function InstallSection() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "chrome" | "safari-mac" | null>(null);

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
                Chrome (Android)
              </button>
              <button
                onClick={() => setPlatform("ios")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[--radius] text-sm text-foreground-muted hover:text-foreground hover:bg-surface-raised border border-border transition-colors"
              >
                <Smartphone size={16} />
                Safari (iOS)
              </button>
              <button
                onClick={() => setPlatform("chrome")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[--radius] text-sm text-foreground-muted hover:text-foreground hover:bg-surface-raised border border-border transition-colors"
              >
                <Laptop size={16} />
                Chrome (Windows &amp; Mac OS)
              </button>
              <button
                onClick={() => setPlatform("safari-mac")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[--radius] text-sm text-foreground-muted hover:text-foreground hover:bg-surface-raised border border-border transition-colors"
              >
                <Laptop size={16} />
                Safari (Mac OS)
              </button>
            </div>
          ) : (
            <div className="rounded-[--radius] bg-surface-raised border border-border px-4 py-3 text-sm text-foreground-muted space-y-2">
              <button onClick={() => setPlatform(null)} className="text-brand hover:underline flex items-center gap-1 mb-2">
                <ChevronDown size={12} className="rotate-90" /> Back
              </button>
              {platform === "android" && (
                <>
                  <p className="font-semibold text-foreground">Install on Chrome (Android)</p>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>Open Revisare in <strong>Chrome</strong></li>
                    <li>Tap the <strong>⋮ menu</strong> (top-right)</li>
                    <li>Select <strong>"Add to Home screen"</strong></li>
                    <li>Tap <strong>Add</strong> to confirm</li>
                  </ol>
                </>
              )}
              {platform === "ios" && (
                <>
                  <p className="font-semibold text-foreground">Install on Safari (iOS)</p>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>Open Revisare in <strong>Safari</strong></li>
                    <li>Tap the <strong>Share</strong> button (bottom bar)</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong> — if you don&apos;t see it, tap <strong>"More"</strong> first</li>
                    <li>Tap <strong>Add</strong> to confirm</li>
                  </ol>
                </>
              )}
              {platform === "chrome" && (
                <>
                  <p className="font-semibold text-foreground">Install via Chrome (Windows &amp; Mac OS)</p>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>Open Revisare in <strong>Chrome</strong></li>
                    <li>Click the <strong>install icon</strong> (⊕) in the address bar on the right — or click the <strong>⋮ menu</strong> (top-right)</li>
                    <li>Select <strong>"Install Revisare…"</strong> or <strong>"Save and share → Install page as app"</strong></li>
                    <li>Click <strong>Install</strong> to confirm</li>
                  </ol>
                </>
              )}
              {platform === "safari-mac" && (
                <>
                  <p className="font-semibold text-foreground">Install via Safari (Mac OS)</p>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>Open Revisare in <strong>Safari</strong></li>
                    <li>Click <strong>File</strong> in the menu bar</li>
                    <li>Select <strong>"Add to Dock…"</strong></li>
                    <li>Click <strong>Add</strong> to confirm — the app will appear in your Dock</li>
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
  const { data: session, status } = useSession();
  const { avatarUrl } = useAvatar();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const user = session?.user;

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

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
          src={avatarUrl ?? undefined}
          size="lg"
        />
        <div>
          <p className="text-lg font-semibold text-foreground">{username}</p>
          <p className="text-sm text-foreground-muted">{user.email}</p>
        </div>
      </div>

      {/* Menu items */}
      <nav className="py-2">
        <Link href="/profile?tab=edit" className="flex items-center gap-3 px-6 py-4 text-base text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors">
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
          onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}
          className="w-full flex items-center gap-3 px-6 py-4 text-base text-danger hover:bg-surface-raised transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
        <div className="my-2 border-t border-border" />
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center gap-3 px-6 py-4 text-sm text-foreground-subtle hover:text-danger hover:bg-surface-raised transition-colors"
          >
            <Trash2 size={16} />
            Delete Account
          </button>
        ) : (
          <div className="px-6 py-4 flex flex-col gap-3">
            <p className="text-sm text-foreground-muted">
              This will anonymize your account. Your debates stay visible but your name and data will be removed. You can sign up again with the same email.
            </p>
            <div className="flex gap-2">
              <button
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  await fetch("/api/me/delete", { method: "DELETE" });
                  await signOut({ callbackUrl: `${window.location.origin}/` });
                }}
                className="px-4 py-2 text-sm rounded bg-danger text-white disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, delete my account"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
