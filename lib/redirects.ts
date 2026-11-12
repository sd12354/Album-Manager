const DEFAULT_REDIRECT = "/dashboard";

export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "https://vinylvault.local");
    if (parsed.origin !== "https://vinylvault.local") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function redirectPathWithSearch(pathname: string, search: string): string {
  return safeInternalRedirect(`${pathname}${search}`);
}
