import Link from "next/link";
import { Sword, Lock, Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Daily Limit Reached" };

export default function DebateGatePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-4">
            <Lock size={26} className="text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">You&apos;ve hit your daily limit</h1>
          <p className="text-sm text-foreground-muted leading-relaxed">
            Free guests can read <span className="text-foreground font-medium">2 debate details per day</span>.
            Create a free account to unlock unlimited access — and to debate yourself.
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <Link href="/auth/signup" className="w-full">
            <Button className="w-full gap-2" size="lg">
              <Flame size={16} />
              Create free account
            </Button>
          </Link>
          <Link href="/auth/login" className="w-full">
            <Button variant="outline" className="w-full" size="lg">
              <Sword size={16} className="mr-2" />
              Log in
            </Button>
          </Link>
        </div>

        <p className="text-xs text-foreground-subtle">
          Your limit resets at midnight.{" "}
          <Link href="/" className="text-brand hover:underline">
            Browse debates
          </Link>{" "}
          in the meantime.
        </p>
      </div>
    </div>
  );
}
