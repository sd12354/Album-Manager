/**
 * Canonical, stable base URL for the app.
 *
 * Auth flows (password recovery, signup confirmation, email change) must point
 * back to a fixed production URL — NOT `window.location.origin`. Vercel gives
 * every deployment its own immutable URL that always serves that exact build,
 * so deriving the redirect from the current origin pins email links to whatever
 * (often stale) deployment the user happened to be on, surfacing an old UI.
 *
 * Set `NEXT_PUBLIC_APP_URL` to your production domain in Vercel so every link
 * resolves to the latest production deployment. Falls back to the current
 * origin in the browser (e.g. local dev) when the env var is unset.
 */
export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}
