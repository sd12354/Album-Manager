const LOCAL_REDIRECT_BASE = "https://vinylvault.local";

export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/dashboard"
) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) {
    return fallback;
  }

  try {
    const url = new URL(candidate, LOCAL_REDIRECT_BASE);
    if (url.origin !== LOCAL_REDIRECT_BASE) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
