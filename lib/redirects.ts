export function safeRelativePath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

    const url = new URL(decoded, "http://vinylvault.local");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
