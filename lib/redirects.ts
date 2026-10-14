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
    const parsed = new URL(trimmed, "https://vinylvault.local");
    if (parsed.origin !== "https://vinylvault.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function currentPathWithSearch(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}
