// Shippo OAuth 2.0 (authorization code) — mirrors the eBay connect flow.
// Requires registering VinylVault as a Shippo OAuth app to obtain a
// SHIPPO_CLIENT_ID / SHIPPO_CLIENT_SECRET and whitelisting the callback URL.

export const SHIPPO_AUTHORIZE_URL = "https://goshippo.com/oauth/authorize";
export const SHIPPO_TOKEN_URL = "https://goshippo.com/oauth/access_token";

// Read + write so we can pull rates and purchase labels on the user's behalf.
export const SHIPPO_SCOPE = "default";

export interface ShippoOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export function getShippoOAuthConfig(): ShippoOAuthConfig | null {
  const clientId = process.env.SHIPPO_CLIENT_ID;
  const clientSecret = process.env.SHIPPO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export interface ShippoTokenResponse {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
}

export async function exchangeShippoCode(
  config: ShippoOAuthConfig,
  code: string,
  redirectUri: string
): Promise<ShippoTokenResponse> {
  const res = await fetch(SHIPPO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        `Shippo token exchange failed (status ${res.status})`
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    scope: data.scope,
  };
}
