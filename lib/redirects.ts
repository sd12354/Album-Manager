export const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function sanitizeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (!value) return fallback;

  try {
    if (!value.startsWith("/") || value.startsWith("//")) return fallback;

    const url = new URL(value, "https://vinylvault.local");
    if (url.origin !== "https://vinylvault.local") return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildProtectedRedirect(pathname: string, search = "") {
  return sanitizeRedirectPath(`${pathname}${search}`, DEFAULT_AUTH_REDIRECT);
}
