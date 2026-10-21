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
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Max albums per bulk sync request (each may call eBay + Discogs). */
const MAX_SYNC = 10;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: albums, error: albumsError } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "sold")
    .or("ebay_listing_id.not.is.null,discogs_listing_id.not.is.null")
    .limit(MAX_SYNC);
  if (albumsError) {
    return NextResponse.json(
      { error: `Could not load albums to sync: ${albumsError.message}` },
      { status: 500 }
    );
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
        const { error: tokenUpdateError } = await supabase
          .from("ebay_credentials")
          .update({
            access_token: tokenResult.token,
            token_expiry: tokenResult.expiry,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        if (tokenUpdateError) {
          return NextResponse.json(
            { error: `Could not save refreshed eBay token: ${tokenUpdateError.message}` },
            { status: 500 }
          );
        }
      }
      ebayToken = tokenResult.token;
    } catch {
      // Non-fatal
    }
  }

  const syncCtx = buildMarketplaceSyncContext(
    {} as Album,
    user.user_metadata,
    ebayCreds
  );

  const synced: Array<{
    albumId: string;
    status: string;
    changed: boolean;
    soldOn?: string;
    delistedFrom?: string[];
  }> = [];

  for (const row of albums ?? []) {
    const album = row as Album;
    const outcome = await checkAlbumMarketplaceState({
      ...syncCtx,
      album,
    });

    if (outcome.changed) {
      const { error: updateError } = await supabase
        .from("albums")
        .update(outcome.updates)
        .eq("id", album.id);
      if (updateError) {
        return NextResponse.json(
          {
            error: `Could not save marketplace sync result for ${album.title}: ${updateError.message}`,
          },
          { status: 500 }
        );
      }

      if (outcome.soldOn) {
        await crossCancelOtherMarketplace(
          album,
          outcome.soldOn,
          syncCtx.discogsAuth,
          ebayToken,
          isRealEbay
        );
      }
    }

    synced.push({
      albumId: album.id,
      status: outcome.changed ? outcome.status : album.status,
      changed: outcome.changed,
      ...(outcome.soldOn ? { soldOn: outcome.soldOn } : {}),
      ...(outcome.delistedFrom.length > 0
        ? { delistedFrom: outcome.delistedFrom }
        : {}),
    });
  }

  const changed = synced.filter((r) => r.changed).length;

  return NextResponse.json({
    synced,
    count: synced.length,
    changed,
    capped: (albums?.length ?? 0) >= MAX_SYNC,
  });
}
