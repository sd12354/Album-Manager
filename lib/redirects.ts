const DEFAULT_AUTH_DESTINATION = "/dashboard";

export function sanitizeInternalPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://vinylvault.local");
    if (parsed.origin !== "http://vinylvault.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function protectedLoginPath(pathname: string, search = ""): string {
  const next = sanitizeInternalPath(`${pathname}${search}`, DEFAULT_AUTH_DESTINATION);
  return `/login?next=${encodeURIComponent(next)}`;
}
