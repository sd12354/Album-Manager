import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SHIPPO_AUTHORIZE_URL,
  SHIPPO_SCOPE,
  getShippoOAuthConfig,
} from "@/lib/shippo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHIPPO_STATE_COOKIE = "shippo_oauth_state";

function getCallbackUrl(request: Request): string {
  const explicit = process.env.SHIPPO_CALLBACK_URL?.trim();
  if (explicit) return explicit;
  return new URL("/api/shippo/callback", request.url).toString();
}

export async function GET(request: Request) {
  const config = getShippoOAuthConfig();
  if (!config) {
    const url = new URL("/settings", request.url);
    url.searchParams.set(
      "shippo_error",
      "Shippo OAuth isn't configured on the server. Add SHIPPO_CLIENT_ID and SHIPPO_CLIENT_SECRET, or use an API key instead."
    );
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: getCallbackUrl(request),
    scope: SHIPPO_SCOPE,
    state,
  });

  const response = NextResponse.redirect(`${SHIPPO_AUTHORIZE_URL}?${params.toString()}`);
  response.cookies.set(SHIPPO_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
