import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteDiscogsListing,
  DiscogsError,
  resolveUserDiscogsAuth,
} from "@/lib/discogs";
import { isLocalMarketplaceListingId } from "@/lib/marketplace-listing";
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

  if (!typedAlbum.discogs_listing_id) {
    return NextResponse.json({ error: "Album is not listed on Discogs" }, { status: 400 });
  }

  const isManualListing = isLocalMarketplaceListingId(
    typedAlbum.discogs_listing_id
  );

  if (!isManualListing) {
    const discogsAuth = resolveUserDiscogsAuth(user.user_metadata);

    if (!discogsAuth) {
      return NextResponse.json(
        { error: "Discogs not connected. Reconnect your account before delisting." },
        { status: 400 }
      );
    }

    try {
      await deleteDiscogsListing(parseInt(typedAlbum.discogs_listing_id, 10), discogsAuth);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Discogs delist failed";
      const status =
        err instanceof DiscogsError && err.status >= 400 && err.status < 600
          ? err.status
          : 502;
      return NextResponse.json({ error: message }, { status });
    }
  }

  // Keep as listed if still on eBay, otherwise revert to unlisted
  const newStatus = typedAlbum.ebay_listing_id ? "listed" : "unlisted";

  const { error: updateError } = await supabase.from("albums").update({
    discogs_listing_id: null,
    discogs_listing_url: null,
    status: newStatus,
  }).eq("id", albumId);

  if (updateError) {
    console.error("[discogs]", {
      scope: "discogs",
      event: "delist_persist_failed",
      albumId,
      listingId: typedAlbum.discogs_listing_id,
      message: updateError.message,
    });
    return NextResponse.json(
      {
        error:
          "Discogs listing was ended, but VinylVault could not save the updated album state. Please refresh before retrying.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
