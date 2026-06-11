import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase.auth.updateUser({
    data: {
      discogs_oauth_token: null,
      discogs_oauth_token_secret: null,
      discogs_username: null,
    },
  });

  return NextResponse.json({ ok: true });
}
