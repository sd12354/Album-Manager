const DEFAULT_REDIRECT = "/dashboard";

export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT
): string {
  if (!value) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

    const url = new URL(decoded, "http://vinylvault.local");
    if (url.origin !== "http://vinylvault.local") return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
