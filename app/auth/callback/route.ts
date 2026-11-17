import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInternalRedirect } from "@/lib/redirects";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeInternalRedirect(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);
  loginUrl.searchParams.set(
    "error",
    "This sign-in link is invalid or has expired. Please try again."
  );
  return NextResponse.redirect(loginUrl);
}
