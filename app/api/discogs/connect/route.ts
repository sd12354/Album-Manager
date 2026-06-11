import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DISCOGS_AUTHORIZE_URL,
  getDiscogsOAuthConfig,
  getDiscogsRequestToken,
} from "@/lib/discogs-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600, // 10 minutes to complete the handshake
};

export async function GET(request: Request) {
  const config = getDiscogsOAuthConfig();
  if (!config) {
    const url = new URL("/settings", request.url);
    url.searchParams.set(
      "discogs_error",
      "Discogs OAuth isn't configured on the server. Add DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET, or use a personal access token."
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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const callbackUrl = `${appUrl}/api/discogs/callback`;

  try {
    const { token, tokenSecret } = await getDiscogsRequestToken(
      config,
      callbackUrl
    );

    const res = NextResponse.redirect(
      `${DISCOGS_AUTHORIZE_URL}?oauth_token=${encodeURIComponent(token)}`
    );
    // Stash the request token secret so the callback can exchange it. The
    // request token itself is echoed back by Discogs and re-verified.
    res.cookies.set("discogs_req_token", token, COOKIE_OPTS);
    res.cookies.set("discogs_req_secret", tokenSecret, COOKIE_OPTS);
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start Discogs OAuth";
    console.error("[discogs]", { scope: "discogs", event: "connect_failed", message });
    const url = new URL("/settings", request.url);
    url.searchParams.set("discogs_error", message);
    return NextResponse.redirect(url);
  }
}
