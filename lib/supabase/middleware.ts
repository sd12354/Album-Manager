import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

function redirectWithSessionCookies(url: URL, supabaseResponse: NextResponse) {
  const response = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

export async function updateSession(request: NextRequest) {
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
  } = await supabase.auth.getUser();

  const protectedPaths = ["/dashboard", "/albums", "/import", "/settings"];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", nextPath);
    return redirectWithSessionCookies(url, supabaseResponse);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    const nextPath = getSafeRedirectPath(
      request.nextUrl.searchParams.get("next"),
      "/dashboard"
    );
    url.pathname = nextPath.split(/[?#]/, 1)[0] || "/dashboard";
    url.search = "";
    const query = nextPath.match(/\?([^#]*)/)?.[1];
    if (query) url.search = `?${query}`;
    url.hash = nextPath.match(/#(.*)$/)?.[0] ?? "";
    return redirectWithSessionCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}
