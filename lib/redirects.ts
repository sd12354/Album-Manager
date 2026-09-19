const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (!value) return fallback;

  try {
    const url = new URL(value, "https://vinylvault.local");
    if (url.origin !== "https://vinylvault.local") return fallback;
    if (!url.pathname.startsWith("/")) return fallback;
    if (url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
