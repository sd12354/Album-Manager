import crypto from "crypto";

/**
 * Discogs OAuth 1.0a helpers.
 *
 * Discogs uses OAuth 1.0a (not OAuth 2.0). We use the PLAINTEXT signature
 * method, which Discogs officially supports because every request is made over
 * HTTPS. PLAINTEXT means the signature is simply the consumer secret and token
 * secret joined by "&" — no HMAC base-string construction needed.
 *
 * Flow:
 *   1. getDiscogsRequestToken()  → temporary request token + secret
 *   2. redirect user to DISCOGS_AUTHORIZE_URL?oauth_token=<request token>
 *   3. getDiscogsAccessToken()   → long-lived access token + secret
 *   4. sign every API request with the access token + secret
 */

export const DISCOGS_REQUEST_TOKEN_URL =
  "https://api.discogs.com/oauth/request_token";
export const DISCOGS_AUTHORIZE_URL = "https://www.discogs.com/oauth/authorize";
export const DISCOGS_ACCESS_TOKEN_URL =
  "https://api.discogs.com/oauth/access_token";
export const DISCOGS_IDENTITY_URL = "https://api.discogs.com/oauth/identity";

const USER_AGENT = process.env.DISCOGS_USER_AGENT ?? "VinylVault/1.0";

export interface DiscogsOAuthConfig {
  consumerKey: string;
  consumerSecret: string;
}

export interface DiscogsTokenPair {
  token: string;
  tokenSecret: string;
}

/** Returns the app's Discogs OAuth credentials, or null if not configured. */
export function getDiscogsOAuthConfig(): DiscogsOAuthConfig | null {
  const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) return null;
  return { consumerKey, consumerSecret };
}

/** Percent-encode per RFC 3986 (encodeURIComponent leaves !*'() alone). */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

interface OAuthHeaderParams {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
  verifier?: string;
  callback?: string;
}

/**
 * Build an OAuth 1.0a `Authorization` header using the PLAINTEXT signature
 * method. The raw signature is `consumerSecret&tokenSecret`; every value
 * (including that "&") is then percent-encoded once when assembled, yielding
 * the `CONSUMER_SECRET%26TOKEN_SECRET` form Discogs expects.
 */
export function buildOAuthAuthorizationHeader(
  params: OAuthHeaderParams
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "PLAINTEXT",
    oauth_signature: `${params.consumerSecret}&${params.tokenSecret ?? ""}`,
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };
  if (params.token) oauthParams.oauth_token = params.token;
  if (params.verifier) oauthParams.oauth_verifier = params.verifier;
  if (params.callback) oauthParams.oauth_callback = params.callback;

  const serialized = Object.entries(oauthParams)
    .map(([key, value]) => `${rfc3986(key)}="${rfc3986(value)}"`)
    .join(", ");

  return `OAuth ${serialized}`;
}

function parseTokenResponse(body: string): DiscogsTokenPair {
  const parsed = new URLSearchParams(body);
  const token = parsed.get("oauth_token");
  const tokenSecret = parsed.get("oauth_token_secret");
  if (!token || !tokenSecret) {
    throw new Error("Discogs did not return an OAuth token pair.");
  }
  return { token, tokenSecret };
}

/** Step 1 — obtain a temporary request token. */
export async function getDiscogsRequestToken(
  config: DiscogsOAuthConfig,
  callbackUrl: string
): Promise<DiscogsTokenPair> {
  const res = await fetch(DISCOGS_REQUEST_TOKEN_URL, {
    method: "GET",
    headers: {
      Authorization: buildOAuthAuthorizationHeader({
        consumerKey: config.consumerKey,
        consumerSecret: config.consumerSecret,
        callback: callbackUrl,
      }),
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Discogs request token failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
  return parseTokenResponse(text);
}

/** Step 3 — exchange the authorized request token for an access token. */
export async function getDiscogsAccessToken(
  config: DiscogsOAuthConfig,
  requestToken: string,
  requestTokenSecret: string,
  verifier: string
): Promise<DiscogsTokenPair> {
  const res = await fetch(DISCOGS_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: buildOAuthAuthorizationHeader({
        consumerKey: config.consumerKey,
        consumerSecret: config.consumerSecret,
        token: requestToken,
        tokenSecret: requestTokenSecret,
        verifier,
      }),
      "User-Agent": USER_AGENT,
      "Content-Length": "0",
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Discogs access token failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
  return parseTokenResponse(text);
}

/** Fetch the connected user's Discogs username for display. */
export async function getDiscogsIdentity(
  config: DiscogsOAuthConfig,
  token: string,
  tokenSecret: string
): Promise<string | null> {
  try {
    const res = await fetch(DISCOGS_IDENTITY_URL, {
      headers: {
        Authorization: buildOAuthAuthorizationHeader({
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          token,
          tokenSecret,
        }),
        "User-Agent": USER_AGENT,
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
