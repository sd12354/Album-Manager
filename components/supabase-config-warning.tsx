import Link from "next/link";
import { VinylLogo } from "@/components/vinyl-logo";
import { MISSING_SUPABASE_CONFIG_MESSAGE } from "@/lib/supabase/config";

export function SupabaseConfigWarning() {
  return (
    <div className="w-full max-w-md rounded-xl border border-white/8 bg-card p-8 text-center animate-fade-in-up">
      <div className="mb-6 flex flex-col items-center">
        <VinylLogo size="lg" className="mb-3" />
      </div>
      <h1 className="font-display text-xl font-bold">
        Supabase is not configured
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {MISSING_SUPABASE_CONFIG_MESSAGE}
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
