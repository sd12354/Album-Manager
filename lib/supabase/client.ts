import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Falls back to safe placeholders during
 * server-side prerender so `next build` doesn't crash before env vars are
 * configured in Vercel (e.g. on the very first deploy). Real values are
 * inlined into the client bundle at build time once the env vars are set,
 * and a subsequent redeploy picks them up automatically.
 */
export function hasSupabaseBrowserConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(url && key);
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key"
    );
  }

  return createBrowserClient(url, key);
}
