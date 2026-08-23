const DEFAULT_REDIRECT = "/dashboard";
const LOCAL_ORIGIN = "https://vinylvault.local";

export function sanitizeNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const url = new URL(value, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN || url.pathname === "/login") {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
