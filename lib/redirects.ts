const DEFAULT_AUTH_DESTINATION = "/dashboard";

export function sanitizeInternalPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;

  try {
    const parsed = new URL(trimmed, "http://internal.local");
    if (parsed.origin !== "http://internal.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

