import { NextResponse } from "next/server";
import { EBAY_AUTH_URL } from "@/lib/ebay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EBAY_SCOPE = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
].join(" ");

export async function GET(request: Request) {
  const clientId = process.env.EBAY_CLIENT_ID;
  const ruName = process.env.EBAY_RU_NAME;

  // Stub mode: redirect to callback directly for dev.
  if (!clientId) {
    return NextResponse.redirect(new URL("/api/ebay/callback?stub=true", request.url));
  }

  if (!ruName) {
    return NextResponse.json(
      {
        error: "Missing EBAY_RU_NAME",
        message:
          "eBay OAuth requires the sandbox RuName as redirect_uri, not http://localhost:3000/api/ebay/callback. Add EBAY_RU_NAME from your eBay Developer keyset, then restart the dev server.",
      },
      { status: 400 }
    );
  }

  // `state` rides along through eBay's OAuth flow untouched. We use it so the
  // shared RuName's callback (NexIssue) can identify VinylVault traffic and
  // forward the `code` back to /api/ebay/callback here.
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: ruName,
    scope: EBAY_SCOPE,
    prompt: "login",
    state: "vinylvault",
  });

  const authUrl = `${EBAY_AUTH_URL}?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
