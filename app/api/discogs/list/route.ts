import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDiscogsListing } from "@/lib/discogs";
import type { Album, AlbumCondition } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userToken = (user.user_metadata as { discogs_token?: string } | null)
    ?.discogs_token;
  const discogsToken = userToken || process.env.DISCOGS_PERSONAL_ACCESS_TOKEN;

  if (!discogsToken) {
    return NextResponse.json(
      { error: "Discogs token not configured. Add it in Settings." },
      { status: 400 }
    );
  }

  const { albumId, listPrice } = await request.json();
  if (!albumId) {
    return NextResponse.json({ error: "albumId required" }, { status: 400 });
  }

  const { data: album, error } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .single();

  if (error || !album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const typedAlbum = album as Album;
  const price =
    listPrice ?? typedAlbum.list_price ?? typedAlbum.suggested_price ?? 9.99;

  // Resolve the Discogs release ID — first from the album column, then from
  // the pricing cache raw_data where it's stored after a price fetch.
  let releaseId: number | null = typedAlbum.discogs_release_id ?? null;

  if (!releaseId) {
    const { data: cacheRow } = await supabase
      .from("pricing_cache")
      .select("raw_data")
      .eq("album_id", albumId)
      .eq("source", "discogs")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const raw = (cacheRow?.raw_data ?? {}) as Record<string, unknown>;
    releaseId = (raw.releaseId as number | undefined) ?? null;
  }

  if (!releaseId) {
    return NextResponse.json(
      {
        error:
          "No Discogs release ID found for this album. Fetch prices first so VinylVault can identify the Discogs release.",
      },
      { status: 400 }
    );
  }

  try {
    const { listingId, listingUrl } = await createDiscogsListing({
      releaseId,
      condition: typedAlbum.condition as AlbumCondition,
      price,
      token: discogsToken,
      comments: typedAlbum.notes ?? undefined,
    });

    await supabase
      .from("albums")
      .update({
        status: "listed",
        discogs_listing_id: String(listingId),
        discogs_listing_url: listingUrl,
        discogs_release_id: releaseId,
        list_price: typedAlbum.list_price ?? price,
      })
      .eq("id", albumId);

    return NextResponse.json({ listingId, listingUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discogs listing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
