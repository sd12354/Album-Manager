import Link from "next/link";
import { VinylLogo } from "@/components/vinyl-logo";

export function SupabaseConfigWarning() {
  return (
    <div className="w-full max-w-md rounded-xl border border-amber-500/30 bg-card p-8 text-center animate-fade-in-up">
      <div className="mb-6 flex flex-col items-center">
        <VinylLogo size="lg" className="mb-3" />
      </div>
      <h1 className="font-display text-xl font-bold text-amber-200">
        Supabase configuration required
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your
        deployment environment, then redeploy VinylVault before signing in.
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
