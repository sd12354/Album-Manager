import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendSaleEmail, emailConfigured } from "@/lib/email";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json(
      { ok: false, error: "Sign in to send a test email." },
      { status: 401 }
    );
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Email isn't configured on this server. Set RESEND_API_KEY (and optionally RESEND_FROM_EMAIL) and redeploy.",
      },
      { status: 500 }
    );
  }

  const result = await sendSaleEmail({
    to: user.email,
    albumTitle: "Abbey Road",
    albumArtist: "The Beatles",
    platform: "eBay",
    soldPrice: 42.0,
    buyerName: "Test Buyer",
    test: true,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: user.email });
}
