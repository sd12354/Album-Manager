import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safePostAuthRedirectPath } from "@/lib/redirects";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safePostAuthRedirectPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "error",
    "This sign-in link is invalid or has expired. Please try signing in again."
  );
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

