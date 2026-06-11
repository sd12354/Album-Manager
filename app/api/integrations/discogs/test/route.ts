import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveDiscogsAuth, testDiscogsConnection } from "@/lib/discogs";

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

  // Prefer a pasted token from the request body (so the user can test before
  // saving). Otherwise resolve the saved auth — OAuth, personal token, or env.
  const auth =
    typeof bodyToken === "string" && bodyToken.trim()
      ? { token: bodyToken.trim() }
      : resolveDiscogsAuth(user.user_metadata);

  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "No Discogs connection configured." },
      { status: 400 }
    );
  }

  const ok = await testDiscogsConnection(auth);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Discogs rejected the credentials." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
