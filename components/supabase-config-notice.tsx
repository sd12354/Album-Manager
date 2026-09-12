import { VinylLogo } from "@/components/vinyl-logo";

export function SupabaseConfigNotice() {
  return (
    <div className="w-full max-w-md rounded-xl border border-white/8 bg-card p-8 text-center animate-fade-in-up">
      <div className="mb-6 flex flex-col items-center">
        <VinylLogo size="lg" className="mb-3" />
      </div>
      <h1 className="font-display text-xl font-bold">
        Supabase is not configured
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your
        environment, then redeploy or restart VinylVault.
      </p>
    </div>
  );
}
