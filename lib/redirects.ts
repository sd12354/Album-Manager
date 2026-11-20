const FALLBACK_POST_AUTH_PATH = "/dashboard";
const AUTH_FLOW_PATHS = ["/login", "/signup", "/reset", "/update-password"];

export function getSafePostAuthRedirectPath(
  value: string | null | undefined,
  fallback = FALLBACK_POST_AUTH_PATH
) {
  if (!value) return fallback;

  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(candidate, "https://vinylvault.local");
    if (url.origin !== "https://vinylvault.local") {
      return fallback;
    }
    if (AUTH_FLOW_PATHS.some((path) => url.pathname.startsWith(path))) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildLoginRedirectUrl(requestUrl: URL) {
  const url = new URL("/login", requestUrl.origin);
  const requestedPath = `${requestUrl.pathname}${requestUrl.search}`;
  url.searchParams.set("next", getSafePostAuthRedirectPath(requestedPath));
  return url;
}
