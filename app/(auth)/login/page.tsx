"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { VinylLogo } from "@/components/vinyl-logo";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createClient,
  getSupabaseBrowserConfigError,
} from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState("/dashboard");
  const router = useRouter();
  const configError = getSupabaseBrowserConfigError();
  const supabase = configError ? null : createClient();

  useEffect(() => {
    const nextPath = new URLSearchParams(window.location.search).get("next");
    if (nextPath?.startsWith("/") && !nextPath.startsWith("//")) {
      setDestination(nextPath);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError(configError ?? "Supabase is not configured.");
      return;
    }
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(destination);
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-md animate-fade-in-up">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to home
      </Link>
      <div className="rounded-xl border border-white/8 bg-card p-8">
      <div className="mb-8 flex flex-col items-center text-center">
        <VinylLogo size="lg" className="mb-3" />
        <p className="text-sm text-muted-foreground">
          Your catalogue. Priced. Listed. Sold.
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
        </div>

        {(configError || error) && (
          <p className="text-sm text-red-400">{configError || error}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={loading || !!configError}
        >
          {loading ? (
            <>
              <VinylSpinner size="sm" />
              Signing in...
            </>
          ) : (
            "Sign In"
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
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/reset" className="hover:text-[#F5F4F0]">
          Forgot password?
        </Link>
      </p>
    </div>
    </div>
  );
}
