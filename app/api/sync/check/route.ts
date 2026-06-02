import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkEbayItemSold,
  endEbayListing,
  getValidEbayToken,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import { deleteDiscogsListing, getDiscogsListingStatus } from "@/lib/discogs";
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

  const { albumId } = await request.json();
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

  if (typedAlbum.status === "sold") {
    return NextResponse.json({ status: "sold", changed: false });
  }

  const userToken = (user.user_metadata as { discogs_token?: string } | null)
    ?.discogs_token;
  const discogsToken = userToken || process.env.DISCOGS_PERSONAL_ACCESS_TOKEN;

  const { data: ebayCreds } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const ebayEnvironment =
    (user.user_metadata as { ebay_environment?: string } | null)
      ?.ebay_environment ?? "stub";

  let soldOn: "ebay" | "discogs" | null = null;
  let soldPrice: number | undefined;

  // ── Check eBay ──────────────────────────────────────────────────────────────
  if (
    typedAlbum.ebay_listing_id &&
    ebayCreds &&
    ebayEnvironment !== "stub" &&
    ebayCreds.access_token !== "stub-access-token"
  ) {
    try {
      const tokenResult = await getValidEbayToken(ebayCreds as EbayTokenCredentials);
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

      const { sold, price } = await checkEbayItemSold(
        typedAlbum.ebay_listing_id,
        tokenResult.token
      );

      if (sold) {
        soldOn = "ebay";
        soldPrice = price ?? typedAlbum.list_price ?? undefined;
      }
    } catch {
      // Non-fatal — continue to check Discogs
    }
  }

  // ── Check Discogs ────────────────────────────────────────────────────────────
  if (!soldOn && typedAlbum.discogs_listing_id && discogsToken) {
    try {
      const result = await getDiscogsListingStatus(
        parseInt(typedAlbum.discogs_listing_id, 10),
        discogsToken
      );

      if (result?.status === "Sold") {
        soldOn = "discogs";
        soldPrice = result.price ?? typedAlbum.list_price ?? undefined;
      }
    } catch {
      // Non-fatal
    }
  }

  if (!soldOn) {
    return NextResponse.json({ status: typedAlbum.status, changed: false });
  }

  // ── Mark sold and cross-cancel ────────────────────────────────────────────────
  await supabase
    .from("albums")
    .update({
      status: "sold",
      sold_price: soldPrice ?? null,
      sold_at: new Date().toISOString(),
    })
    .eq("id", albumId);

  // Cancel the other platform's listing in the background — non-fatal if it fails.
  if (soldOn === "ebay" && typedAlbum.discogs_listing_id && discogsToken) {
    try {
      await deleteDiscogsListing(
        parseInt(typedAlbum.discogs_listing_id, 10),
        discogsToken
      );
    } catch {
      // Discogs removal failed — not critical, it will expire naturally
    }
  }

  if (soldOn === "discogs" && typedAlbum.ebay_listing_id && ebayCreds) {
    try {
      const tokenResult = await getValidEbayToken(ebayCreds as EbayTokenCredentials);
      if (ebayEnvironment !== "stub" && ebayCreds.access_token !== "stub-access-token") {
        await endEbayListing(typedAlbum.ebay_listing_id, tokenResult.token);
      }
    } catch {
      // eBay removal failed — not critical
    }
  }

  return NextResponse.json({
    status: "sold",
    soldOn,
    soldPrice,
    changed: true,
  });
}
