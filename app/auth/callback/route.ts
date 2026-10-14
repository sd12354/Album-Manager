import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInternalRedirect } from "@/lib/redirects";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeInternalRedirect(requestUrl.searchParams.get("next"));
  const redirectTo = new URL(next, requestUrl.origin);

  if (!code) {
    redirectTo.pathname = "/login";
    redirectTo.search = "";
    redirectTo.searchParams.set("error", "missing_code");
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirectTo.pathname = "/login";
    redirectTo.search = "";
    redirectTo.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(redirectTo);
  }

  return NextResponse.redirect(redirectTo);
}
