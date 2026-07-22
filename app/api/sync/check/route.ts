import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidEbayToken,
  hasRealEbayCredentials,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import {
  buildMarketplaceSyncContext,
  checkAlbumMarketplaceState,
  crossCancelOtherMarketplace,
} from "@/lib/marketplace-sync";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 45;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { albumId } = await request.json().catch(() => ({}));
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

  if ((album as Album).user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the collection owner can sync marketplace sales." },
      { status: 403 }
    );
  }

  const typedAlbum = album as Album;

  if (typedAlbum.status === "sold") {
    return NextResponse.json({ status: "sold", changed: false });
  }

  if (!typedAlbum.ebay_listing_id && !typedAlbum.discogs_listing_id) {
    return NextResponse.json({ status: typedAlbum.status, changed: false });
  }

  // Manually-tracked listings have no marketplace API to query against.
  const ebayListingId = typedAlbum.ebay_listing_id ?? "";
  const discogsListingId = typedAlbum.discogs_listing_id ?? "";
  const ebayIsManual =
    ebayListingId.startsWith("manual-") || ebayListingId.startsWith("STUB-");
  const discogsIsManual = discogsListingId.startsWith("manual-");
  if (
    (!typedAlbum.ebay_listing_id || ebayIsManual) &&
    (!typedAlbum.discogs_listing_id || discogsIsManual)
  ) {
    return NextResponse.json({
      status: typedAlbum.status,
      changed: false,
      manualOnly: true,
    });
  }

  const { data: ebayCreds, error: ebayCredsError } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (ebayCredsError) {
    return NextResponse.json(
      { error: `Could not load eBay credentials: ${ebayCredsError.message}` },
      { status: 500 }
    );
  }

  const isRealEbay = hasRealEbayCredentials(ebayCreds);
  let ebayToken: string | null = null;

  if (isRealEbay && ebayCreds) {
    try {
      const tokenResult = await getValidEbayToken(
        ebayCreds as EbayTokenCredentials
      );
      if (tokenResult.refreshed) {
        const { error: refreshError } = await supabase
          .from("ebay_credentials")
          .update({
            access_token: tokenResult.token,
            token_expiry: tokenResult.expiry,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        if (refreshError) {
          return NextResponse.json(
            {
              error: `Could not save refreshed eBay token: ${refreshError.message}`,
            },
            { status: 500 }
          );
        }
      }
      ebayToken = tokenResult.token;
    } catch {
      // Continue — delist detection may still work for Discogs.
    }
  }

  const outcome = await checkAlbumMarketplaceState(
    buildMarketplaceSyncContext(typedAlbum, user.user_metadata, ebayCreds)
  );

  if (!outcome.changed) {
    return NextResponse.json({ status: typedAlbum.status, changed: false });
  }

  const { error: updateError } = await supabase
    .from("albums")
    .update(outcome.updates)
    .eq("id", albumId);
  if (updateError) {
    return NextResponse.json(
      { error: `Could not save marketplace sync result: ${updateError.message}` },
      { status: 500 }
    );
  }

  if (outcome.soldOn) {
    await crossCancelOtherMarketplace(
      typedAlbum,
      outcome.soldOn,
      buildMarketplaceSyncContext(typedAlbum, user.user_metadata, ebayCreds)
        .discogsAuth,
      ebayToken,
      isRealEbay
    );
  }

  if (!outcome.soldOn) {
    return NextResponse.json({
      status: outcome.status,
      changed: true,
      delistedFrom: outcome.delistedFrom,
    });
  }

  return NextResponse.json({
    status: "sold",
    soldOn: outcome.soldOn,
    soldPrice: outcome.soldPrice,
    changed: true,
    buyerAddressRaw: outcome.buyerAddressRaw,
  });
}
