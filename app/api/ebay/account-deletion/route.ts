import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEndpointUrl(request: Request): string {
  const configured = process.env.EBAY_ACCOUNT_DELETION_ENDPOINT_URL;
  if (configured) return configured;

  // Fallback makes local/preview verification easier, but production should
  // set EBAY_ACCOUNT_DELETION_ENDPOINT_URL to the exact URL entered in eBay.
  return new URL(request.url).origin + "/api/ebay/account-deletion";
}

function getVerificationToken(): string {
  const token = process.env.EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN;
  if (!token) {
    throw new Error("Missing EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN");
  }
  return token;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challengeCode = searchParams.get("challenge_code");

  if (!challengeCode) {
    return NextResponse.json(
      { error: "Missing challenge_code" },
      { status: 400 }
    );
  }

  const verificationToken = getVerificationToken();
  const endpointUrl = getEndpointUrl(request);
  const challengeResponse = createHash("sha256")
    .update(challengeCode)
    .update(verificationToken)
    .update(endpointUrl)
    .digest("hex");

  return NextResponse.json({ challengeResponse });
}

export async function POST(request: Request) {
  // eBay sends marketplace account deletion notifications here after
  // verification. We currently don't store eBay account identifiers separately,
  // so acknowledge the event and keep the endpoint compliant.
  await request.json().catch(() => null);
  return NextResponse.json({ ok: true });
}
