import { AlertTriangle } from "lucide-react";
import { missingSupabaseConfigMessage } from "@/lib/supabase/client";

export function SupabaseConfigWarning() {
  return (
    <div className="w-full max-w-md rounded-xl border border-amber-500/30 bg-card p-8 text-center animate-fade-in-up">
      <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-amber-400" />
      <h1 className="font-display text-xl font-bold">Supabase is not configured</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {missingSupabaseConfigMessage}
      </p>
    </div>
  );
}
