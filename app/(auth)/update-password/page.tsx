"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { VinylLogo } from "@/components/vinyl-logo";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const PASSWORD_RULES = [
  { id: "length", label: "at least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "one uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "one lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "one number", test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "one special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkRecoverySession() {
      const code =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("code")
          : null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/update-password");
        }
        if (error) {
          if (!mounted) return;
          setError(
            "This reset link is invalid or has expired. Request a new password reset email."
          );
          setCheckingSession(false);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      if (!session) {
        setError(
          "This reset link is invalid or has expired. Request a new password reset email."
        );
      }
      setCheckingSession(false);
    }

    void checkRecoverySession();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const failedRule = PASSWORD_RULES.find((rule) => !rule.test(password));
    if (failedRule) {
      setError(`Password must include ${failedRule.label}.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-white/8 bg-card p-8 animate-fade-in-up">
      <div className="mb-8 flex flex-col items-center text-center">
        <VinylLogo size="lg" className="mb-3" />
        <p className="text-sm text-muted-foreground">Choose a new password</p>
      </div>

      {checkingSession ? (
        <div className="flex justify-center py-8">
          <VinylSpinner size="lg" label="Checking reset link..." />
        </div>
      ) : success ? (
        <div className="text-center">
          <p className="text-sm text-foreground">Password updated.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Taking you back to your dashboard...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || error.startsWith("This reset link")}
          >
            {loading ? (
              <>
                <VinylSpinner size="sm" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/reset" className="hover:text-foreground">
              Request a new reset link
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
