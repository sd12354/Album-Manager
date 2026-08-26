import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  endEbayListing,
  getValidEbayToken,
  hasRealEbayCredentials,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import { isLocalMarketplaceListingId } from "@/lib/marketplace-sync";
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

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .single();
  if (albumError || !album) {
    return NextResponse.json(
      { error: albumError?.message ?? "Album not found" },
      { status: albumError?.code === "PGRST116" ? 404 : 500 }
    );
  }

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

  if (!typedAlbum.ebay_listing_id) {
    return NextResponse.json({ error: "Album is not listed on eBay" }, { status: 400 });
  }

  const { data: ebayCreds } = await supabase.from("ebay_credentials").select("*").eq("user_id", user.id).maybeSingle();

  const isRealEbay = hasRealEbayCredentials(ebayCreds);
  const isManualListing = isLocalMarketplaceListingId(typedAlbum.ebay_listing_id);

  if (isRealEbay && ebayCreds && !isManualListing) {
    try {
      const tokenResult = await getValidEbayToken(ebayCreds as EbayTokenCredentials);
      if (tokenResult.refreshed) {
        const { error: refreshError } = await supabase.from("ebay_credentials").update({
          access_token: tokenResult.token,
          token_expiry: tokenResult.expiry,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);
        if (refreshError) {
          return NextResponse.json(
            { error: `Could not refresh eBay credentials: ${refreshError.message}` },
            { status: 500 }
          );
        }
      }
      await endEbayListing(typedAlbum.ebay_listing_id, tokenResult.token);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "eBay rejected the delist request.";
      return NextResponse.json(
        {
          error: `Could not end the eBay listing. VinylVault kept the album marked as listed. ${message}`,
        },
        { status: 502 }
      );
    }
  }

  // Determine new status — if still listed on Discogs, keep as listed
  const newStatus = typedAlbum.discogs_listing_id ? "listed" : "unlisted";

  const { error: updateError } = await supabase.from("albums").update({
    ebay_listing_id: null,
    ebay_listing_url: null,
    status: newStatus,
  }).eq("id", albumId);

  if (updateError) {
    console.error("[ebay]", {
      scope: "ebay",
      event: "delist_persist_failed",
      albumId,
      listingId: typedAlbum.ebay_listing_id,
      message: updateError.message,
    });
    return NextResponse.json(
      {
        error:
          "eBay listing was ended, but VinylVault could not save the updated album state. Please refresh before retrying.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, stub: !isRealEbay });
}
