const SAFE_PATH_PATTERN = /^\/(?!\/|\\)/;

export function getRelativePath(url: Pick<URL, "pathname" | "search">) {
  return `${url.pathname}${url.search}`;
}

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard"
) {
  if (!value) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (
    !SAFE_PATH_PATTERN.test(decoded) ||
    decoded.includes("\0") ||
    decoded.startsWith("/%2f") ||
    decoded.startsWith("/%5c")
  ) {
    return fallback;
  }

  return decoded;
}
