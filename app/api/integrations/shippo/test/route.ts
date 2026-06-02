import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateShippoKey } from "@/lib/shippo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey } = await request.json().catch(() => ({}));
  const key = apiKey || process.env.SHIPPO_API_KEY;

  if (!key) {
    return NextResponse.json({ error: "No API key provided" }, { status: 400 });
  }

  const ok = await validateShippoKey(key);
  if (ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "Invalid Shippo API key — check it and try again." },
    { status: 400 }
  );
}
