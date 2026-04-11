"use client";

import Link from "next/link";
import { useState } from "react";
import { Sword, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const emailOrUsername = formData.get("emailOrUsername") as string;

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUsername }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30 mb-4">
            <Sword size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
          <p className="text-sm text-foreground-muted mt-1 text-center">
            Enter your email or username and we'll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-[--radius] border border-border bg-surface p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Mail size={20} className="text-green-400" />
            </div>
            <p className="text-sm text-foreground">
              If an account with that email exists, we've sent a reset link. Check your inbox.
            </p>
            <Link href="/auth/login" className="block text-sm text-brand hover:text-brand-hover transition-colors">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email or Username"
              name="emailOrUsername"
              type="text"
              placeholder="you@example.com or your_username"
              leftIcon={<Mail size={15} />}
              autoComplete="username"
              required
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="submit" size="lg" isLoading={isLoading} className="w-full mt-1">
              Send reset link
            </Button>
            <p className="text-center text-sm text-foreground-muted">
              <Link href="/auth/login" className="text-brand hover:text-brand-hover font-medium transition-colors">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
