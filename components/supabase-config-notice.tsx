import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { VinylLogo } from "@/components/vinyl-logo";
import { Button } from "@/components/ui/button";

export function SupabaseConfigNotice() {
  return (
    <div className="w-full max-w-md rounded-xl border border-amber-500/30 bg-card p-8 text-center animate-fade-in-up">
      <div className="mb-6 flex flex-col items-center">
        <VinylLogo size="lg" className="mb-3" />
        <div className="rounded-full border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
      </div>

      <h1 className="font-display text-xl font-bold">
        Supabase is not configured
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your deployment
        environment, then rebuild VinylVault to enable authentication.
      </p>

      <Button asChild className="mt-6 w-full" size="lg">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
