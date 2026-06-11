import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeShippoCode, getShippoOAuthConfig } from "@/lib/shippo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

function getCallbackUrl(request: Request): string {
  const explicit = process.env.SHIPPO_CALLBACK_URL?.trim();
  if (explicit) return explicit;
  return new URL("/api/shippo/callback", request.url).toString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (oauthError) {
    return settingsRedirect(request, {
      shippo_error: oauthErrorDescription ?? oauthError,
    });
  }

  const config = getShippoOAuthConfig();
  if (!config) {
    return settingsRedirect(request, {
      shippo_error: "Shippo OAuth isn't configured on the server.",
    });
  }

  if (!code) {
    return settingsRedirect(request, {
      shippo_error:
        "Shippo authorization was incomplete. Please try connecting again.",
    });
  }

  try {
    const { accessToken } = await exchangeShippoCode(
      config,
      code,
      getCallbackUrl(request)
    );

    await supabase.auth.updateUser({
      data: {
        shippo_oauth_token: accessToken,
        shippo_account_label: "Shippo account",
        // Connecting implies the user wants auto-labels available.
        shippo_enabled: true,
      },
    });

    return settingsRedirect(request, { shippo: "connected" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Shippo OAuth exchange failed";
    return settingsRedirect(request, { shippo_error: message });
  }
}
