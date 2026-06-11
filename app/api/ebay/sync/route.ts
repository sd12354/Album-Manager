import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TODO: Replace with real eBay GetItem polling for sold status
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: listedAlbums } = await supabase
    .from("albums")
    .select("*")
    .eq("status", "listed")
    .eq("user_id", user.id);

  const synced = [];

  for (const album of listedAlbums ?? []) {
    // Stub: no automatic sold detection in dev
    synced.push({ albumId: album.id, status: "listed", stub: true });
  }

  return NextResponse.json({ synced, count: synced.length });
}
