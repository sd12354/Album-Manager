const DEFAULT_REDIRECT_PATH = "/dashboard";

/**
 * Return a same-origin app path for post-auth redirects. Absolute URLs,
 * protocol-relative URLs, and malformed values fall back to a safe default.
 */
export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT_PATH
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) return fallback;

  try {
    const parsed = new URL(trimmed, "https://vinylvault.local");
    if (parsed.origin !== "https://vinylvault.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

