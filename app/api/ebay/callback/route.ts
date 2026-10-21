import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  EBAY_ENVIRONMENT,
  EBAY_IDENTITY_URL,
  EBAY_TOKEN_URL,
  hasRealEbayCredentials,
} from "@/lib/ebay";
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

const EBAY_STATE_COOKIE = "ebay_oauth_state";

function settingsRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete(EBAY_STATE_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
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
    return settingsRedirect(request, {
      ebay_error: ebayErrorDescription ?? ebayError,
    });
  }

  const stubRequested = stub === "true" || !process.env.EBAY_CLIENT_ID;
  if (stubRequested) {
    if (process.env.NODE_ENV === "production") {
      return settingsRedirect(request, {
        ebay_error: "eBay OAuth is not configured for this deployment.",
      });
    }

    const { data: existingCreds } = await supabase
      .from("ebay_credentials")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (hasRealEbayCredentials(existingCreds)) {
      return settingsRedirect(request, {
        ebay_error:
          "A real eBay connection already exists. Disconnect it before using the local stub.",
      });
    }

    const { error: upsertError } = await supabase.from("ebay_credentials").upsert({
      user_id: user.id,
      access_token: "stub-access-token",
      refresh_token: "stub-refresh-token",
      token_expiry: new Date(Date.now() + 7200000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      return settingsRedirect(request, {
        ebay_error: "Could not save the eBay connection. Please try again.",
      });
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ebay_username: "vinyl_collector_pro",
        ebay_environment: "stub",
      },
    });
    if (metadataError) {
      return settingsRedirect(request, {
        ebay_error: "Could not save the eBay connection details. Please try again.",
      });
    }
  } else {
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;
    const ruName = process.env.EBAY_RU_NAME;
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(EBAY_STATE_COOKIE)?.value;

    if (!state || !expectedState || state !== expectedState) {
      return settingsRedirect(request, {
        ebay_error:
          "eBay authorization expired or did not match this session. Please try connecting again.",
      });
    }

    if (!code || !clientId || !clientSecret || !ruName) {
      return settingsRedirect(request, {
        ebay_error: "Missing eBay OAuth configuration",
      });
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
      return settingsRedirect(request, { ebay_error: message });
    }

    const { error: upsertError } = await supabase.from("ebay_credentials").upsert({
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expiry: new Date(
        Date.now() + Number(tokenData.expires_in ?? 7200) * 1000
      ).toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      return settingsRedirect(request, {
        ebay_error: "Could not save the eBay connection. Please try again.",
      });
    }

    // Try to fetch the user's real eBay handle. Falls back to a generic label
    // if the identity scope isn't granted or the keyset doesn't allow it.
    const realUsername = await fetchEbayUsername(tokenData.access_token);
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ebay_username:
          realUsername ??
          (EBAY_ENVIRONMENT === "production"
            ? "eBay user"
            : "eBay sandbox user"),
        ebay_environment: EBAY_ENVIRONMENT,
      },
    });
    if (metadataError) {
      return settingsRedirect(request, {
        ebay_error: "Could not save the eBay connection details. Please try again.",
      });
    }
  }

  return settingsRedirect(request, { ebay: "connected" });
}
