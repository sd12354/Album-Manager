import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteDiscogsListing, resolveDiscogsAuth } from "@/lib/discogs";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    albumId?: string;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { albumId } = body;
  if (!albumId) return NextResponse.json({ error: "albumId required" }, { status: 400 });

  const { data: album } = await supabase.from("albums").select("*").eq("id", albumId).single();
  if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

  if ((album as Album).user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the collection owner can manage marketplace listings." },
      { status: 403 }
    );
  }

  const typedAlbum = album as Album;
  if (typedAlbum.status === "sold") {
    return NextResponse.json(
      { error: "Sold albums cannot be delisted." },
      { status: 409 }
    );
  }

  if (!typedAlbum.discogs_listing_id) {
    return NextResponse.json({ error: "Album is not listed on Discogs" }, { status: 400 });
  }

  const discogsAuth = resolveDiscogsAuth(user.user_metadata);

  if (discogsAuth) {
    await deleteDiscogsListing(parseInt(typedAlbum.discogs_listing_id, 10), discogsAuth);
  }

  // Keep as listed if still on eBay, otherwise revert to unlisted
  const newStatus = typedAlbum.ebay_listing_id ? "listed" : "unlisted";

  await supabase.from("albums").update({
    discogs_listing_id: null,
    discogs_listing_url: null,
    status: newStatus,
  }).eq("id", albumId);

  return NextResponse.json({ ok: true });
}
