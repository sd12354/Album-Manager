import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getDiscogsAccessToken,
  getDiscogsIdentity,
  getDiscogsOAuthConfig,
} from "@/lib/discogs-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete("discogs_req_token");
  res.cookies.delete("discogs_req_secret");
  return res;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get("oauth_token");
  const verifier = searchParams.get("oauth_verifier");
  const denied = searchParams.get("denied");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (denied) {
    return settingsRedirect(request, {
      discogs_error: "Discogs authorization was declined.",
    });
  }

  const config = getDiscogsOAuthConfig();
  if (!config) {
    return settingsRedirect(request, {
      discogs_error: "Discogs OAuth isn't configured on the server.",
    });
  }

  const cookieStore = await cookies();
  const reqToken = cookieStore.get("discogs_req_token")?.value;
  const reqSecret = cookieStore.get("discogs_req_secret")?.value;

  if (!oauthToken || !verifier || !reqToken || !reqSecret) {
    return settingsRedirect(request, {
      discogs_error:
        "Discogs authorization expired or was incomplete. Please try connecting again.",
    });
  }

  if (oauthToken !== reqToken) {
    return settingsRedirect(request, {
      discogs_error: "Discogs authorization token mismatch. Please try again.",
    });
  }

  try {
    const { token, tokenSecret } = await getDiscogsAccessToken(
      config,
      reqToken,
      reqSecret,
      verifier
    );

    const username = await getDiscogsIdentity(config, token, tokenSecret).catch(
      () => null
    );

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        discogs_oauth_token: token,
        discogs_oauth_token_secret: tokenSecret,
        discogs_username: username ?? "Discogs user",
      },
    });
    if (metadataError) {
      throw new Error(
        `Could not save Discogs account details: ${metadataError.message}`
      );
    }

    console.log("[discogs]", {
      scope: "discogs",
      event: "connect_success",
      username: username ?? null,
    });

    return settingsRedirect(request, { discogs: "connected" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Discogs OAuth exchange failed";
    console.error("[discogs]", {
      scope: "discogs",
      event: "callback_failed",
      message,
    });
    return settingsRedirect(request, { discogs_error: message });
  }
}
