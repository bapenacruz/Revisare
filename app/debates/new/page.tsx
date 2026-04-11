import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Lock } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Challenge" };

export default function NewDebatePage() {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16 text-center">
      <Card>
        <CardBody className="flex flex-col items-center gap-4 py-12">
          <div className="w-14 h-14 rounded-full bg-brand-dim flex items-center justify-center">
            <Lock size={24} className="text-brand" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Sign in to challenge</h1>
          <p className="text-sm text-foreground-muted max-w-xs">
            You need an account to create a debate challenge. It only takes a minute.
          </p>
          <div className="flex gap-3 mt-2">
            <Link href="/auth/signup">
              <Button>Create Account</Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="secondary">Log in</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
