import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function loginRedirect(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const destination = sanitizeRedirectPath(url.searchParams.get("next"));

  if (providerError) {
    return loginRedirect(request, providerError);
  }

  if (!code) {
    return loginRedirect(request, "The sign-in link is invalid or has expired.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginRedirect(request, error.message);
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
