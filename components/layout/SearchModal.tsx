"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User, Swords, Tag, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

type SearchResults = {
  users: { username: string; avatarUrl: string | null; elo: number; country: string | null }[];
  debates: { challengeId: string; motion: string; category: { label: string; emoji: string }; debaterA: { username: string } | null; debaterB: { username: string } | null }[];
  categories: { slug: string; label: string; emoji: string }[];
};

export function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 300);
  }

  function navigate(path: string) {
    onClose();
    router.push(path);
  }

  const hasResults = results && (results.users.length > 0 || results.debates.length > 0 || results.categories.length > 0);
  const empty = results && !hasResults && query.length >= 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-[--radius-lg] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={17} className="text-foreground-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Search users, debates, categories…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle outline-none"
          />
          {loading && <Loader2 size={15} className="text-foreground-muted animate-spin shrink-0" />}
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-raised text-foreground-muted hover:text-foreground transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Results */}
        {hasResults && (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {/* Users */}
            {results.users.length > 0 && (
              <section className="py-2">
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1.5">
                  <User size={10} /> Users
                </p>
                {results.users.map((u) => (
                  <button
                    key={u.username}
                    onClick={() => navigate(`/users/${u.username}`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-raised transition-colors text-left"
                  >
                    <Avatar initial={u.username[0].toUpperCase()} src={u.avatarUrl ?? undefined} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{u.username}</p>
                      {u.country && <p className="text-xs text-foreground-subtle truncate">{u.country}</p>}
                    </div>
                    <span className="text-xs text-foreground-subtle">{u.elo} ELO</span>
                  </button>
                ))}
              </section>
            )}

            {/* Debates */}
            {results.debates.length > 0 && (
              <section className="py-2">
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1.5">
                  <Swords size={10} /> Debates
                </p>
                {results.debates.map((d) => (
                  <button
                    key={d.challengeId}
                    onClick={() => navigate(`/debates/${d.challengeId}/results`)}
                    className="w-full flex flex-col gap-0.5 px-4 py-2.5 hover:bg-surface-raised transition-colors text-left"
                  >
                    <p className="text-sm text-foreground line-clamp-1">{d.motion}</p>
                    <p className="text-xs text-foreground-subtle">
                      {d.category.emoji} {d.category.label} · {d.debaterA?.username ?? "?"} vs {d.debaterB?.username ?? "?"}
                    </p>
                  </button>
                ))}
              </section>
            )}

            {/* Categories */}
            {results.categories.length > 0 && (
              <section className="py-2">
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle flex items-center gap-1.5">
                  <Tag size={10} /> Categories
                </p>
                {results.categories.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => navigate(`/categories/${c.slug}`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-raised transition-colors text-left"
                  >
                    <span className="text-xl">{c.emoji}</span>
                    <span className="text-sm text-foreground">{c.label}</span>
                  </button>
                ))}
              </section>
            )}
          </div>
        )}

        {empty && (
          <div className="px-4 py-8 text-center text-sm text-foreground-muted">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {!results && query.length < 3 && (
          <div className="px-4 py-6 text-center text-xs text-foreground-subtle">
            Type at least 3 characters to search
          </div>
        )}
      </div>
    </div>
  );
}
