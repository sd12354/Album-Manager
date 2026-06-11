import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveShippoAuth, validateShippoAuth, type ShippoAuth } from "@/lib/shippo";
import type { UserSettings } from "@/types";

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

  // A pasted key takes precedence (so the user can verify before saving);
  // otherwise fall back to the connected OAuth account / saved key / env key.
  const auth: ShippoAuth | null = apiKey
    ? { token: apiKey, scheme: "ShippoToken" }
    : resolveShippoAuth((user.user_metadata ?? {}) as UserSettings);

  if (!auth) {
    return NextResponse.json(
      { error: "No Shippo credentials provided" },
      { status: 400 }
    );
  }

  const ok = await validateShippoAuth(auth);
  if (ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "Invalid Shippo credentials — check them and try again." },
    { status: 400 }
  );
}
