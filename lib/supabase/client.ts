import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Falls back to safe placeholders during
 * server-side prerender so `next build` doesn't crash before env vars are
 * configured in Vercel (e.g. on the very first deploy). Real values are
 * inlined into the client bundle at build time once the env vars are set,
 * and a subsequent redeploy picks them up automatically.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (typeof window !== "undefined") {
      throw new Error(
        "Supabase environment variables are not set. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project settings, then redeploy."
      );
    }
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key"
    );
  }

  return createBrowserClient(url, key);
}
