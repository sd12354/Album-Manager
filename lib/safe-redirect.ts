export const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (!value) return fallback;

  try {
    const url = new URL(value, "https://vinylvault.local");
    if (url.origin !== "https://vinylvault.local") return fallback;

    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    if (url.pathname === "/login" || url.pathname === "/signup") return fallback;

    return path;
  } catch {
    return fallback;
  }
}
