export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = "/dashboard"
) {
  if (!value) return fallback;

  try {
    const parsed = new URL(value, "http://vinylvault.local");
    if (parsed.origin !== "http://vinylvault.local") return fallback;
    if (!parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
