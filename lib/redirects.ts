const DEFAULT_REDIRECT = "/dashboard";

type SearchParamsLike = Pick<URLSearchParams, "get">;

export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT
): string {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://vinylvault.local");
    if (parsed.origin !== "http://vinylvault.local") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getSafeNextParam(
  params: SearchParamsLike,
  fallback = DEFAULT_REDIRECT
): string {
  return safeInternalRedirect(params.get("next"), fallback);
}

export function authCallbackUrl(next: string): string {
  const url = new URL(`${safeInternalRedirect(next)}`, "http://vinylvault.local");
  const callback = new URL("/auth/callback", "http://vinylvault.local");
  callback.searchParams.set(
    "next",
    `${url.pathname}${url.search}${url.hash}`
  );
  return `${callback.pathname}${callback.search}`;
}
