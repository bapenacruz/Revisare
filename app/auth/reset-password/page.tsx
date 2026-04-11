"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sword, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <p className="text-sm text-danger text-center">
        Invalid or missing reset token.{" "}
        <Link href="/auth/forgot-password" className="text-brand hover:text-brand-hover">
          Request a new one.
        </Link>
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/auth/login"), 2000);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <p className="text-sm text-green-400 text-center">
        Password updated! Redirecting to login…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="New password"
        name="password"
        type={showPassword ? "text" : "password"}
        placeholder="••••••••"
        leftIcon={<Lock size={15} />}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="pointer-events-auto text-foreground-muted hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Input
        label="Confirm new password"
        name="confirm"
        type={showPassword ? "text" : "password"}
        placeholder="••••••••"
        leftIcon={<Lock size={15} />}
        autoComplete="new-password"
        required
        minLength={8}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" size="lg" isLoading={isLoading} className="w-full mt-1">
        Set new password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30 mb-4">
            <Sword size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
          <p className="text-sm text-foreground-muted mt-1">Choose a strong password for your account.</p>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
