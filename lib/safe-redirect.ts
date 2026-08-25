export const DEFAULT_AUTH_REDIRECT = "/dashboard";

const SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    SCHEME_RE.test(trimmed)
  ) {
    return fallback;
  }

  return trimmed;
}
