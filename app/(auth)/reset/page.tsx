"use client";

import { useState } from "react";
import Link from "next/link";
import { VinylLogo } from "@/components/vinyl-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/site-url";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const trimmedEmail = email.trim();
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${getAppUrl()}/update-password`,
    });

    if (error) {
      setError(
        error.message.includes("Error sending")
          ? "We couldn't send the reset email. Please try again shortly or contact support if it keeps happening."
          : error.message
      );
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-white/8 bg-card p-8 animate-fade-in-up">
      <div className="mb-8 flex flex-col items-center text-center">
        <VinylLogo size="lg" className="mb-3" />
        <p className="text-sm text-muted-foreground">Reset your password</p>
      </div>

      {sent ? (
        <div className="text-center">
          <p className="text-sm text-[#F5F4F0]">
            Check your email for a password reset link.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm text-accent hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-[#F5F4F0]">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
