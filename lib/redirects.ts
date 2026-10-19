const DEFAULT_REDIRECT = "/dashboard";

export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, "https://vinylvault.local");
    if (url.origin !== "https://vinylvault.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
