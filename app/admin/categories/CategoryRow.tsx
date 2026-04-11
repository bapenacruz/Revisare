"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  label: string;
  emoji: string;
  description: string;
  order: number;
  isActive: boolean;
  slug: string;
}

export function CategoryRow({ cat }: { cat: Category }) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(cat.isActive);
  const [loading, setLoading] = useState(false);

  async function toggleActive() {
    setLoading(true);
    const next = !isActive;
    setIsActive(next);
    await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, isActive: next }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <tr className="bg-background hover:bg-surface transition-colors">
      <td className="px-4 py-3">
        <span className="text-xl mr-2">{cat.emoji}</span>
        <span className="font-medium text-foreground">{cat.label}</span>
      </td>
      <td className="px-4 py-3 text-foreground-muted text-xs">{cat.slug}</td>
      <td className="px-4 py-3 text-foreground-muted text-sm max-w-xs truncate">
        {cat.description}
      </td>
      <td className="px-4 py-3 text-foreground-muted text-center">{cat.order}</td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={toggleActive}
          disabled={loading}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
            isActive ? "bg-brand" : "bg-border"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              isActive ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </td>
    </tr>
  );
}
