"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HScrollSectionProps {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function HScrollSection({ title, badge, children, className }: HScrollSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    ref.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  return (
    <section className={cn("mb-10", className)}>
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {badge}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-border text-foreground-muted hover:text-foreground hover:border-brand/40 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-border text-foreground-muted hover:text-foreground hover:border-brand/40 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="flex overflow-x-auto gap-3 px-4 sm:px-6 pb-2 scrollbar-none snap-x snap-mandatory"
      >
        {children}
      </div>
    </section>
  );
}
