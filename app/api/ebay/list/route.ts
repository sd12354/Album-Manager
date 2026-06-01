import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildListingDescription,
  buildListingTitle,
  getCategoryForGenre,
  getSandboxListingUrl,
} from "@/lib/ebay";
import { EBAY_MAX_PHOTOS, getOriginalPublicUrl } from "@/lib/photos";
import type { Album } from "@/types";

// TODO: Replace with real eBay Trading API AddItem call
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
  const listingId = `STUB-${Date.now()}`;
  const listingUrl = getSandboxListingUrl(listingId);

  // Pass through full-resolution photo URLs unchanged. eBay's Picture Service
  // (EPS) fetches each URL and hosts the original master internally — they
  // generate their own thumbnails, so we must NOT pre-shrink. We strip any
  // Supabase transform query params as a belt-and-braces guard.
  const pictureUrls = (typedAlbum.photo_urls ?? [])
    .slice(0, EBAY_MAX_PHOTOS)
    .map(getOriginalPublicUrl);

  // TODO: When the real Trading API call lands, this maps directly to:
  //   <PictureDetails>
  //     <PhotoDisplay>PicturePack</PhotoDisplay>
  //     {pictureUrls.map(u => <PictureURL>{u}</PictureURL>)}
  //   </PictureDetails>
  const _payload = {
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

  await supabase
    .from("albums")
    .update({
      status: "listed",
      ebay_listing_id: listingId,
      ebay_listing_url: listingUrl,
      list_price: price,
    })
    .eq("id", albumId);

  return NextResponse.json({
    listingId,
    listingUrl,
    payload: _payload,
    stub: true,
  });
}
