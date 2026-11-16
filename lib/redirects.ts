const DEFAULT_AUTH_DESTINATION = "/dashboard";

export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, "http://vinylvault.local");
    if (url.origin !== "http://vinylvault.local") {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function createLoginRedirectUrl(requestUrl: URL) {
  const loginUrl = new URL("/login", requestUrl);
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    sanitizeInternalRedirect(`${requestUrl.pathname}${requestUrl.search}`)
  );
  return loginUrl;
}
