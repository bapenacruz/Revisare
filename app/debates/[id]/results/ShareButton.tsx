"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";

interface ShareButtonProps {
  challengeId: string;
  motion: string;
}

export function ShareButton({ challengeId, motion }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/debates/${challengeId}/results`;
    if (navigator.share) {
      try {
        await navigator.share({ title: motion, url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 text-sm text-foreground-muted hover:text-brand transition-colors"
    >
      {copied ? (
        <>
          <Check size={15} className="text-green-500" />
          <span className="text-green-500">Link copied!</span>
        </>
      ) : (
        <>
          <Share2 size={15} />
          Share this debate
        </>
      )}
    </button>
  );
}
