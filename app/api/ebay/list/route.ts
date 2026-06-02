import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createEbayListing,
  getValidEbayToken,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import type { Album } from "@/types";

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
    return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });
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

  const ebayEnvironment =
    (user.user_metadata as { ebay_environment?: string } | null)
      ?.ebay_environment ?? "stub";

  // Stub mode: generate a fake listing so the UI can show the listed state.
  if (
    ebayEnvironment === "stub" ||
    creds.access_token === "stub-access-token"
  ) {
    const fakeItemId = `STUB-${Date.now()}`;
    await supabase
      .from("albums")
      .update({
        status: "listed",
        ebay_listing_id: fakeItemId,
        ebay_listing_url: `https://sandbox.ebay.com/itm/${fakeItemId}`,
        list_price: price,
      })
      .eq("id", albumId);

    return NextResponse.json({
      stub: true,
      listingId: fakeItemId,
      listingUrl: `https://sandbox.ebay.com/itm/${fakeItemId}`,
      message: "Stub listing created — connect a real eBay sandbox/production account to post live listings.",
    });
  }

  // Real listing via Trading API.
  const tokenResult = await getValidEbayToken(creds as EbayTokenCredentials);

  if (tokenResult.refreshed) {
    await supabase
      .from("ebay_credentials")
      .update({
        access_token: tokenResult.token,
        token_expiry: tokenResult.expiry,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  try {
    const { itemId, listingUrl } = await createEbayListing(
      typedAlbum,
      price,
      tokenResult.token
    );

    await supabase
      .from("albums")
      .update({
        status: "listed",
        ebay_listing_id: itemId,
        ebay_listing_url: listingUrl,
        list_price: price,
      })
      .eq("id", albumId);

    return NextResponse.json({ listingId: itemId, listingUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "eBay listing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
