const DEFAULT_AUTH_REDIRECT = "/dashboard";

/**
 * Only allow same-origin app paths for post-auth redirects. Absolute URLs,
 * protocol-relative URLs, and encoded variants are rejected to avoid open
 * redirects from login/signup/callback flows.
 */
export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (!value) return fallback;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

  try {
    const parsed = new URL(decoded, "https://vinylvault.local");
    if (parsed.origin !== "https://vinylvault.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function protectedLoginPath(pathname: string, search = "") {
  const target = `${pathname}${search}`;
  const params = new URLSearchParams({ next: target });
  return `/login?${params.toString()}`;
}

export function redirectPathFromSearch(search: string, fallback = DEFAULT_AUTH_REDIRECT) {
  const params = new URLSearchParams(search);
  return sanitizeInternalRedirect(params.get("next"), fallback);
}
