import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  endEbayListing,
  getValidEbayToken,
  hasRealEbayCredentials,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import { deleteDiscogsListing } from "@/lib/discogs";
import {
  canManage,
  getDiscogsAuthForOwner,
  getRoleForOwner,
} from "@/lib/collections";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function isLocalMarketplaceListing(listingId: string | null | undefined) {
  return (
    typeof listingId === "string" &&
    (listingId.startsWith("manual-") || listingId.startsWith("STUB-"))
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { albumIds } = await request.json().catch(() => ({})) as { albumIds?: string[] };
  if (!albumIds || albumIds.length === 0) {
    return NextResponse.json({ error: "albumIds required" }, { status: 400 });
  }

  const { data: albums } = await supabase
    .from("albums")
    .select("*")
    .in("id", albumIds);

  if (!albums || albums.length === 0) {
    return NextResponse.json({ error: "No albums found" }, { status: 404 });
  }

  const foundIds = new Set((albums as Album[]).map((album) => album.id));
  const missingIds = albumIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    return NextResponse.json(
      {
        error: "Some albums were not found.",
        requested: albumIds.length,
        found: albums.length,
        missingIds,
      },
      { status: 404 }
    );
  }

  const ownerIds = new Set((albums as Album[]).map((album) => album.user_id));
  if (ownerIds.size !== 1) {
    return NextResponse.json(
      { error: "Delete albums from one collection at a time." },
      { status: 400 }
    );
  }

  const ownerId = ownerIds.values().next().value as string;
  const role = await getRoleForOwner(user, ownerId);
  if (!canManage(role)) {
    return NextResponse.json(
      { error: "You need editor access to delete albums from this collection." },
      { status: 403 }
    );
  }
  const isOwner = role === "owner";

  const hasMarketplaceListings = (albums as Album[]).some(
    (album) => album.discogs_listing_id || album.ebay_listing_id
  );
  if (!isOwner && hasMarketplaceListings) {
    return NextResponse.json(
      {
        error:
          "Only the collection owner can delete albums with active marketplace listings.",
      },
      { status: 403 }
    );
  }

  const discogsAuth = await getDiscogsAuthForOwner(user, ownerId);

  const { data: ebayCreds } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", ownerId)
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
        }).eq("user_id", ownerId);
      }
    }
  }

  // Remove active platform listings before deleting. Marketplace credentials
  // belong to the owner, so only attempt delisting in the owner's own context.
  if (isOwner) {
    const delistErrors: string[] = [];
    for (const album of albums as Album[]) {
      const discogsListingId = album.discogs_listing_id;
      const ebayListingId = album.ebay_listing_id;
      const discogsIsLocal = isLocalMarketplaceListing(discogsListingId);
      const ebayIsLocal = isLocalMarketplaceListing(ebayListingId);

      if (discogsListingId && !discogsIsLocal && !discogsAuth) {
        delistErrors.push(`${album.title} (Discogs): credentials unavailable`);
      } else if (discogsListingId && !discogsIsLocal && discogsAuth) {
        const numericListingId = parseInt(discogsListingId, 10);
        if (!Number.isFinite(numericListingId)) {
          delistErrors.push(`${album.title} (Discogs): invalid listing id`);
          continue;
        }
        try {
          await deleteDiscogsListing(numericListingId, discogsAuth);
        } catch (err) {
          delistErrors.push(
            `${album.title} (Discogs): ${err instanceof Error ? err.message : "delist failed"}`
          );
        }
      }
      if (ebayListingId && !ebayIsLocal && isRealEbay && !ebayToken) {
        delistErrors.push(`${album.title} (eBay): credentials unavailable`);
      } else if (ebayListingId && !ebayIsLocal && ebayToken && isRealEbay) {
        try {
          await endEbayListing(ebayListingId, ebayToken);
        } catch (err) {
          delistErrors.push(
            `${album.title} (eBay): ${err instanceof Error ? err.message : "delist failed"}`
          );
        }
      }
    }
    if (delistErrors.length > 0) {
      return NextResponse.json(
        {
          error:
            "Could not delete because one or more marketplace listings could not be ended.",
          details: delistErrors,
        },
        { status: 502 }
      );
    }
  }

  const { error } = await supabase
    .from("albums")
    .delete()
    .in("id", albumIds)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: albums.length });
}
