const DEFAULT_POST_AUTH_PATH = "/dashboard";
const INTERNAL_ORIGIN = "https://vinylvault.local";

const AUTH_FLOW_PREFIXES = ["/login", "/signup", "/reset", "/update-password", "/auth"];

/**
 * Return a safe internal path for post-auth redirects.
 *
 * Only root-relative paths are accepted. Absolute URLs, protocol-relative
 * values, backslash tricks, and auth-flow destinations are rejected so login
 * cannot be used as an open redirect or redirect loop.
 */
export function safePostAuthRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_POST_AUTH_PATH
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (
      AUTH_FLOW_PREFIXES.some(
        (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
      )
    ) {
      return fallback;
    }
    return path;
  } catch {
    return fallback;
  }
}

