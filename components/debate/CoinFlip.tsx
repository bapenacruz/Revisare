"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

interface Participant {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface CoinFlipProps {
  coinFlipWinnerId: string;
  debaterA: Participant;
  debaterB: Participant;
  onComplete: () => void;
}

export function CoinFlip({ coinFlipWinnerId, debaterA, debaterB, onComplete }: CoinFlipProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setRevealed(true), 2200);
    const t2 = setTimeout(() => onComplete(), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  const winner = coinFlipWinnerId === debaterA.id ? debaterA : debaterB;

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-8 text-center">
      {/* Players */}
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center gap-2 opacity-70">
          <Avatar initial={debaterA.username[0]} size="lg" />
          <span className="text-sm font-medium text-foreground">{debaterA.username}</span>
        </div>

        {/* Coin */}
        <div className="relative w-16 h-16">
          <div
            className="w-16 h-16 rounded-full border-4 border-accent bg-accent/20 flex items-center justify-center text-2xl font-black text-accent"
            style={{
              animation: "coin-spin 2s ease-out forwards",
            }}
          >
            ?
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 opacity-70">
          <Avatar initial={debaterB.username[0]} size="lg" />
          <span className="text-sm font-medium text-foreground">{debaterB.username}</span>
        </div>
      </div>

      {/* Result */}
      <div
        className="transition-all duration-500"
        style={{ opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(8px)" }}
      >
        <p className="text-foreground-muted text-sm mb-1">Coin flip result</p>
        <p className="text-xl font-bold text-foreground">
          <span className="text-accent">{winner.username}</span> goes first!
        </p>
        <p className="text-foreground-muted text-sm mt-1">
          {winner.username} argues <span className="text-brand font-semibold">Proposition</span>
        </p>
      </div>

      <style>{`
        @keyframes coin-spin {
          0%   { transform: rotateY(0deg);   }
          60%  { transform: rotateY(720deg); }
          80%  { transform: rotateY(700deg); }
          100% { transform: rotateY(720deg); }
        }
      `}</style>
    </div>
  );
}
