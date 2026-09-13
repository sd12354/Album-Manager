const DEFAULT_REDIRECT = "/dashboard";

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT
): string {
  if (!value) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /^[a-z][a-z0-9+.-]*:/i.test(decoded)
    ) {
      return fallback;
    }
    return decoded;
  } catch {
    return fallback;
  }
}
