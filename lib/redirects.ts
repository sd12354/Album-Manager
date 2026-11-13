const DEFAULT_AUTH_DESTINATION = "/dashboard";

export function sanitizeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION
) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://vinylvault.local");
    if (url.origin !== "https://vinylvault.local") return fallback;
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/signup")) {
      return fallback;
    }
    if (url.pathname.startsWith("/auth/callback")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
