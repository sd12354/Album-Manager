import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  checkBackendHealth,
  isBackendOutageError,
  isDowntimeExemptPath,
  isMaintenanceMode,
  maintenanceAllowsEmail,
  markBackendUnhealthy,
} from "@/lib/backend-health";

function redirectWithSessionCookies(url: URL, supabaseResponse: NextResponse) {
  const response = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

/**
 * Serve the downtime page in place of whatever was requested. The address in
 * the browser stays the same, so a reload lands people back where they were
 * headed once the site returns. API callers get a plain 503 instead of HTML.
 */
function downtimeResponse(request: NextRequest) {
  const headers = { "Retry-After": "120", "Cache-Control": "no-store" };
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "VinylVault is temporarily unavailable. Please try again shortly." },
      { status: 503, headers }
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.rewrite(url, { status: 503, headers });
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // The downtime page and its health checks must never be blocked themselves.
  if (isDowntimeExemptPath(pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Planned maintenance: everyone sees the downtime page except accounts on
  // the allow list, who can sign in at /login?staff to check the work live.
  if (isMaintenanceMode(process.env)) {
    const allowed = maintenanceAllowsEmail(user?.email, process.env);
    const staffLogin =
      pathname === "/login" && request.nextUrl.searchParams.has("staff");
    if (!allowed && !staffLogin) {
      return downtimeResponse(request);
    }
  }

  const backendDown = isBackendOutageError(userError);
  if (backendDown) {
    markBackendUnhealthy("session check failed");
  }

  const protectedPaths = ["/dashboard", "/albums", "/import", "/settings"];
  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isAuthFlowPage =
    isAuthPage ||
    pathname.startsWith("/reset") ||
    pathname.startsWith("/update-password");

  // Unplanned outage: if the backend is unreachable, paused or restricted,
  // signing in cannot work. Show the downtime page rather than a login form
  // that fails with "Failed to fetch". (With no session cookie getUser() makes
  // no network call, so probe the backend directly; the result is cached.)
  if (!user && (isProtected || isAuthFlowPage)) {
    const down = backendDown || !(await checkBackendHealth()).ok;
    if (down) {
      return downtimeResponse(request);
    }
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithSessionCookies(url, supabaseResponse);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return redirectWithSessionCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}
