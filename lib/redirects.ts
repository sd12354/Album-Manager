const AUTH_FLOW_PATHS = [
  "/login",
  "/signup",
  "/reset",
  "/update-password",
  "/auth/callback",
];

export function sanitizeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard"
) {
  const target = value?.trim();
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(target, "https://vinylvault.local");
    if (parsed.origin !== "https://vinylvault.local") return fallback;
    if (
      AUTH_FLOW_PATHS.some(
        (path) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`)
      )
    ) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function requestedPathFromUrl(url: Pick<URL, "pathname" | "search" | "hash">) {
  return `${url.pathname}${url.search}${url.hash}`;
}
