import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES } from "@/lib/mock-data";
import { Card, CardBody } from "@/components/ui/Card";
import { formatCount } from "@/lib/utils";

export function CategoriesPreview() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mb-16">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-foreground">Browse Categories</h2>
        <Link
          href="/categories"
          className="text-sm text-brand hover:text-brand-hover transition-colors"
        >
          All categories →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => (
          <Link key={cat.id} href={`/categories/${cat.id}`}>
            <Card
              interactive
              className="h-full group text-center"
            >
              <CardBody className="flex flex-col items-center gap-2 px-3 py-4">
                <span className="text-3xl">{cat.emoji}</span>
                <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                <span className="text-xs text-foreground-subtle">
                  {formatCount(cat.debateCount)} debates
                </span>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {/* Banner CTA */}
      <div className="mt-8 rounded-[--radius-xl] bg-gradient-to-r from-brand/20 via-brand/10 to-transparent border border-brand/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Ready to challenge someone?
          </h3>
          <p className="text-sm text-foreground-muted">
            Pick a topic and get matched with a worthy opponent. Ranked or casual.
          </p>
        </div>
        <Link
          href="/debates/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[--radius] bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-lg shadow-brand/20 shrink-0"
        >
          New Challenge
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
