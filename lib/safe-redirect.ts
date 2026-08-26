const DEFAULT_SAFE_REDIRECT = "/dashboard";

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_SAFE_REDIRECT
) {
  if (!value) return fallback;

  try {
    const parsed = new URL(value, "https://vinylvault.local");

    if (parsed.origin !== "https://vinylvault.local") {
      return fallback;
    }

    if (parsed.pathname.startsWith("/auth/callback")) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildAuthCallbackUrl(nextPath: string) {
  const url = new URL("/auth/callback", "https://vinylvault.local");
  url.searchParams.set("next", getSafeRedirectPath(nextPath));
  return `${url.pathname}${url.search}`;
}
