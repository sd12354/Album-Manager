const FALLBACK_PATH = "/";

export function sanitizeInternalPath(
  value: string | null | undefined,
  fallback = FALLBACK_PATH
) {
  if (!value) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

    const url = new URL(decoded, "https://vinylvault.local");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildCurrentPath(pathname: string, search: string) {
  return `${pathname}${search}`;
}
