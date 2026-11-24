const DEFAULT_AUTH_DESTINATION = "/dashboard";

function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function sanitizeNextPath(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_AUTH_DESTINATION;

  const isRelative = isSafeRelativePath(trimmed);
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  if (!isRelative && !isAbsolute) {
    return DEFAULT_AUTH_DESTINATION;
  }

  try {
    const parsed = new URL(trimmed, "https://vinylvault.local");
    const originalIsRelative = isRelative;
    const originalIsSameOrigin = parsed.origin === "https://vinylvault.local";

    if (!originalIsRelative && !originalIsSameOrigin) {
      return DEFAULT_AUTH_DESTINATION;
    }

    const destination = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return isSafeRelativePath(destination) ? destination : DEFAULT_AUTH_DESTINATION;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}

export function currentPathWithSearch(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}
