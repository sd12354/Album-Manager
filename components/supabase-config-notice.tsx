import Link from "next/link";

export function SupabaseConfigNotice() {
  return (
    <div className="w-full max-w-md rounded-xl border border-amber-500/30 bg-card p-8 text-center animate-fade-in-up">
      <h1 className="font-display text-xl font-bold text-amber-200">
        Supabase is not configured
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to the deployment
        environment, then redeploy VinylVault.
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
