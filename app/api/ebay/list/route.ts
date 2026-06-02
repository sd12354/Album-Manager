import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildListingDescription,
  buildListingTitle,
  getCategoryForGenre,
} from "@/lib/ebay";
import { EBAY_MAX_PHOTOS, getOriginalPublicUrl } from "@/lib/photos";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * eBay AddItem stub.
 *
 * Real Trading API integration is NOT yet implemented. Calling this endpoint
 * builds the payload that *would* be sent to eBay and returns it as a
 * preview, but does not actually create a listing. We intentionally do NOT
 * update the album to status='listed' because that would make the UI lie.
 *
 * To wire up real listing we need to:
 *   1. POST XML to https://api.ebay.com/ws/api.dll with the user's OAuth
 *      token via the X-EBAY-API-IAF-TOKEN header.
 *   2. Use a verb of AddFixedPriceItem (or AddItem) with the payload below
 *      serialized to the Trading XML schema.
 *   3. Configure business policies on the eBay account (shipping, returns,
 *      payment) and reference them by ID in the request.
 *   4. Map condition + genre to eBay item specifics (Format=Vinyl, etc.).
 *   5. Handle the long tail of validation errors eBay returns.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { albumId, listPrice } = await request.json();

  if (!albumId) {
    return NextResponse.json({ error: "albumId required" }, { status: 400 });
  }

  const { data: creds } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!creds) {
    return NextResponse.json(
      { error: "eBay account not connected" },
      { status: 400 }
    );
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
  const price = listPrice ?? typedAlbum.list_price ?? typedAlbum.suggested_price ?? 9.99;

  // Pass through full-resolution photo URLs unchanged. eBay's Picture Service
  // (EPS) fetches each URL and hosts the original master internally — they
  // generate their own thumbnails, so we must NOT pre-shrink. We strip any
  // Supabase transform query params as a belt-and-braces guard.
  const pictureUrls = (typedAlbum.photo_urls ?? [])
    .slice(0, EBAY_MAX_PHOTOS)
    .map(getOriginalPublicUrl);

  const payload = {
    title: buildListingTitle(typedAlbum.artist, typedAlbum.title, typedAlbum.condition),
    description: buildListingDescription(
      typedAlbum.artist,
      typedAlbum.title,
      typedAlbum.condition,
      typedAlbum.genre,
      typedAlbum.catalog_number
    ),
    categoryId: getCategoryForGenre(typedAlbum.genre),
    price,
    condition: typedAlbum.condition,
    pictureUrls,
  };

  // Honest stub: surface the payload but do NOT mutate the album, do NOT
  // generate fake listing IDs/URLs, and return `stub: true` so the UI can
  // tell the user this was a preview.
  return NextResponse.json({
    stub: true,
    message:
      "Preview only — eBay AddItem isn't wired up yet, so nothing was posted. The payload below is what would be sent.",
    payload,
  });
}
