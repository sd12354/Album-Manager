"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { VinylLogo } from "@/components/vinyl-logo";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupabaseConfigNotice } from "@/components/supabase-config-notice";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { buildAuthCallbackUrl } from "@/lib/safe-redirect";
import { getAppUrl } from "@/lib/site-url";

const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p: string) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "One special character",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
] as const;

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const router = useRouter();

  if (!isSupabaseConfigured()) {
    return <SupabaseConfigNotice />;
  }

  const supabase = createClient();

  const passwordChecks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));
  const isPasswordStrong = passwordChecks.every((c) => c.passed);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isPasswordStrong) {
      setError("Please choose a stronger password that meets all requirements.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Ensures the confirmation link (when email confirmation is enabled
        // in Supabase) returns the user to the canonical production app rather
        // than an ephemeral deployment URL or localhost.
        emailRedirectTo: `${getAppUrl()}${buildAuthCallbackUrl("/dashboard")}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Supabase signals "email already registered" by returning a user whose
    // identities array is empty (to avoid leaking which emails exist).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError(
        "An account with this email already exists. Try signing in instead."
      );
      setLoading(false);
      return;
    }

    if (data.session) {
      // Email confirmation is disabled on the project — the user is already
      // signed in, so go straight to the dashboard.
      router.push("/dashboard");
      router.refresh();
    } else {
      // Confirmation is enabled — a verification email was sent. Show a
      // "check your inbox" state instead of bouncing to a protected page.
      setAwaitingConfirmation(true);
      setLoading(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="w-full max-w-md rounded-xl border border-white/8 bg-card p-8 text-center animate-fade-in-up">
        <div className="mb-6 flex flex-col items-center">
          <VinylLogo size="lg" className="mb-3" />
        </div>
        <h1 className="font-display text-xl font-bold">Check your email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Click the
          link to verify your account, then sign in.
        </p>
        <Button asChild className="mt-6 w-full" size="lg">
          <Link href="/login">Go to Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-white/8 bg-card p-8 animate-fade-in-up">
      <div className="mb-8 flex flex-col items-center text-center">
        <VinylLogo size="lg" className="mb-3" />
        <p className="text-sm text-muted-foreground">
          Create your VinylVault account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="collector@vinyl.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#F5F4F0]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {password.length > 0 && (
            <ul className="mt-2 grid grid-cols-1 gap-1">
              {passwordChecks.map((check) => (
                <li
                  key={check.id}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${
                    check.passed ? "text-emerald-400" : "text-muted-foreground"
                  }`}
                >
                  {check.passed ? (
                    <Check className="h-3 w-3 shrink-0" />
                  ) : (
                    <X className="h-3 w-3 shrink-0" />
                  )}
                  {check.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirm_password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#F5F4F0]"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <X className="h-3 w-3 shrink-0" />
              Passwords do not match
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={loading || !isPasswordStrong || !passwordsMatch}
        >
          {loading ? (
            <>
              <VinylSpinner size="sm" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
