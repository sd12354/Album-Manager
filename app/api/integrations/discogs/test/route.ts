import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testDiscogsConnection } from "@/lib/discogs";

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

  const { token: bodyToken } = await request.json().catch(() => ({}));

  // Prefer token from request body (so user can test before saving), then
  // user_metadata, then env var.
  const userToken = (user.user_metadata as { discogs_token?: string } | null)
    ?.discogs_token;
  const token =
    (typeof bodyToken === "string" && bodyToken.trim()) ||
    userToken ||
    process.env.DISCOGS_PERSONAL_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "No Discogs token configured." },
      { status: 400 }
    );
  }

  const ok = await testDiscogsConnection(token);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Discogs rejected the token." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
