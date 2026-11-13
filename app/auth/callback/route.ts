import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/lib/redirects";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeRedirectPath(url.searchParams.get("next"));

  if (!code) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "missing_code");
    return NextResponse.redirect(login);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
