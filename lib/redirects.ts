export const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (!value) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
      return fallback;
    }

    const url = new URL(decoded, "https://vinylvault.local");
    if (url.origin !== "https://vinylvault.local") {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function authCallbackUrl(next?: string | null) {
  const safeNext = sanitizeInternalRedirect(next);
  const params = new URLSearchParams({ next: safeNext });
  return `/auth/callback?${params.toString()}`;
}
