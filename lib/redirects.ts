const DEFAULT_SAFE_REDIRECT = "/dashboard";
const BASE_URL = "https://vinylvault.local";

export function sanitizeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_SAFE_REDIRECT
) {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, BASE_URL);
    if (url.origin !== BASE_URL) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
