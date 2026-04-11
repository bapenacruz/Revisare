"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sword, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

const WELCOME_KEY = "arguably_hero_welcome";

export function Hero() {
  const [show, setShow] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const fromParam = searchParams.get("welcome") === "1";
    const fromStorage = localStorage.getItem(WELCOME_KEY) === "1";
    if (fromParam || fromStorage) {
      localStorage.removeItem(WELCOME_KEY);
      setShow(true);
      if (fromParam) {
        // Clean the URL without re-rendering
        router.replace("/", { scroll: false });
      }
    }
  }, [searchParams, router]);

  if (!show) return null;

  return (
    <section className="relative overflow-hidden pt-8 pb-10">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand/8 rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs text-foreground-muted mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span>AI-judged ranked debates are live</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.15] tracking-tight text-foreground mb-4">
          Argue your case.{" "}
          <span className="text-brand">Get judged.</span>{" "}
          Rise the ranks.
        </h1>

        <p className="text-base sm:text-lg text-foreground-muted max-w-xl mx-auto mb-6 leading-relaxed">
          Challenge opponents on any topic, structured formats, AI panel judging.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/challenges/new">
            <Button size="lg" className="min-w-36">
              <Sword size={16} />
              Start Debating
            </Button>
          </Link>
          <Link href="/explore">
            <Button variant="secondary" size="lg" className="min-w-36">
              <Zap size={16} />
              Watch Live
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

