import { NextResponse } from "next/server";
import { EBAY_ENVIRONMENT, EBAY_IDENTITY_URL, EBAY_TOKEN_URL } from "@/lib/ebay";
import { createClient } from "@/lib/supabase/server";

/**
 * Calls eBay's Identity API to fetch the real username for the access token.
 * Requires the `commerce.identity.readonly` OAuth scope. Returns null on any
 * failure so we can fall back to a generic label instead of breaking the
 * connect flow.
 */
async function fetchEbayUsername(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(EBAY_IDENTITY_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { username?: string };
    return data.username ?? null;
  } catch {
    return null;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const ebayError = searchParams.get("error");
  const ebayErrorDescription = searchParams.get("error_description");
  const stub = searchParams.get("stub");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (ebayError) {
    const url = new URL("/settings", request.url);
    url.searchParams.set("ebay_error", ebayErrorDescription ?? ebayError);
    return NextResponse.redirect(url);
  }

  if (stub === "true" || !process.env.EBAY_CLIENT_ID) {
    await supabase.from("ebay_credentials").upsert({
      user_id: user.id,
      access_token: "stub-access-token",
      refresh_token: "stub-refresh-token",
      token_expiry: new Date(Date.now() + 7200000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    await supabase.auth.updateUser({
      data: {
        ebay_username: "vinyl_collector_pro",
        ebay_environment: "stub",
      },
    });
  } else {
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;
    const ruName = process.env.EBAY_RU_NAME;

    if (!code || !clientId || !clientSecret || !ruName) {
      return NextResponse.redirect(
        new URL(
          "/settings?ebay_error=Missing%20eBay%20OAuth%20configuration",
          request.url
        )
      );
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const tokenResponse = await fetch(EBAY_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        // eBay requires the same RuName here, not the callback URL.
        redirect_uri: ruName,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      const message =
        tokenData.error_description ??
        tokenData.error ??
        "Could not exchange eBay OAuth code for tokens";
      const url = new URL("/settings", request.url);
      url.searchParams.set("ebay_error", message);
      return NextResponse.redirect(url);
    }

    await supabase.from("ebay_credentials").upsert({
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expiry: new Date(
        Date.now() + Number(tokenData.expires_in ?? 7200) * 1000
      ).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Try to fetch the user's real eBay handle. Falls back to a generic label
    // if the identity scope isn't granted or the keyset doesn't allow it.
    const realUsername = await fetchEbayUsername(tokenData.access_token);
    await supabase.auth.updateUser({
      data: {
        ebay_username:
          realUsername ??
          (EBAY_ENVIRONMENT === "production"
            ? "eBay user"
            : "eBay sandbox user"),
        ebay_environment: EBAY_ENVIRONMENT,
      },
    });
  }

  return NextResponse.redirect(new URL("/settings?ebay=connected", request.url));
}
