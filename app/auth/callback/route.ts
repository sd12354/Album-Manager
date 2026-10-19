import { NextResponse, type NextRequest } from "next/server";
import { sanitizeInternalRedirect } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeInternalRedirect(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL(next, request.url);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }
  }

  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set(
    "error",
    "Your sign-in link is invalid or has expired. Please try again."
  );
  return NextResponse.redirect(errorUrl);
}
