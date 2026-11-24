import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNextPath(url.searchParams.get("next"));

  if (!code) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
