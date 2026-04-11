"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a server configuration problem. Please try again later.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign-in link has expired or has already been used.",
  OAuthAccountNotLinked:
    "This email is already registered with a different sign-in method. Please use the original method.",
  OAuthCallbackError: "Something went wrong during sign-in. Please try again.",
  Default: "An unexpected error occurred during sign-in. Please try again.",
};

function AuthErrorContent() {
  const params = useSearchParams();
  const error = params.get("error") ?? "Default";
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-danger/10 mx-auto mb-5">
          <AlertTriangle size={26} className="text-danger" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Sign-in error</h1>
        <p className="text-sm text-foreground-muted mb-6 leading-relaxed">{message}</p>
        <Link href="/auth/login">
          <Button variant="primary" size="lg" className="w-full">Back to login</Button>
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
