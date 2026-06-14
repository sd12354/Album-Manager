import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  endEbayListing,
  getValidEbayToken,
  hasRealEbayCredentials,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import { deleteDiscogsListing, resolveDiscogsAuth } from "@/lib/discogs";
import { getActiveContext } from "@/lib/collections";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const ctx = await getActiveContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.canEdit) {
    return NextResponse.json(
      { error: "You have view-only access to this collection." },
      { status: 403 }
    );
  }
  const user = ctx.user;
  const isOwner = ctx.role === "owner";

  const { albumIds } = await request.json() as { albumIds: string[] };
  if (!albumIds || albumIds.length === 0) {
    return NextResponse.json({ error: "albumIds required" }, { status: 400 });
  }

  const { data: albums } = await supabase
    .from("albums")
    .select("*")
    .in("id", albumIds)
    .eq("user_id", ctx.ownerId);

  if (!albums || albums.length === 0) {
    return NextResponse.json({ error: "No albums found" }, { status: 404 });
  }

  if (!isOwner) {
    const listedAlbums = (albums as Album[]).filter(
      (album) => album.ebay_listing_id || album.discogs_listing_id
    );
    if (listedAlbums.length > 0) {
      return NextResponse.json(
        {
          error:
            "Only the collection owner can delete albums that are listed on marketplaces. Ask the owner to delist them first.",
        },
        { status: 403 }
      );
    }
  }

  const discogsAuth = resolveDiscogsAuth(user.user_metadata);

  const { data: ebayCreds } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const isRealEbay = hasRealEbayCredentials(ebayCreds);
  let ebayToken: string | null = null;

  if (isRealEbay && ebayCreds) {
    const tokenResult = await getValidEbayToken(ebayCreds as EbayTokenCredentials).catch(() => null);
    if (tokenResult) {
      ebayToken = tokenResult.token;
      if (tokenResult.refreshed) {
        await supabase.from("ebay_credentials").update({
          access_token: tokenResult.token,
          token_expiry: tokenResult.expiry,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);
      }
    }
  }

  // Remove active platform listings before deleting. Marketplace credentials
  // belong to the owner, so only attempt delisting in the owner's own context.
  if (isOwner) {
    for (const album of albums as Album[]) {
      if (album.discogs_listing_id && discogsAuth) {
        await deleteDiscogsListing(parseInt(album.discogs_listing_id, 10), discogsAuth).catch(() => null);
      }
      if (album.ebay_listing_id && ebayToken && isRealEbay) {
        await endEbayListing(album.ebay_listing_id, ebayToken).catch(() => null);
      }
    }
  }

  const { error } = await supabase
    .from("albums")
    .delete()
    .in("id", albumIds)
    .eq("user_id", ctx.ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: albums.length });
}
