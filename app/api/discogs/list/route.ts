import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createDiscogsListing,
  getDiscogsListingStatus,
  resolveUserDiscogsAuth,
  DiscogsError,
} from "@/lib/discogs";
import { generateListingDescription } from "@/lib/ai-pricing";
import { resolveListingPrice } from "@/lib/marketplace-listing";
import type { Album, AlbumCondition } from "@/types";

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

  const discogsAuth = resolveUserDiscogsAuth(user.user_metadata);

  if (!discogsAuth) {
    return NextResponse.json(
      { error: "Discogs not connected. Connect your account in Settings." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    albumId?: string;
    listPrice?: number;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { albumId, listPrice } = body;
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
      {
        error:
          "Only the collection owner can list to marketplaces. Ask them to list this album from their account.",
      },
      { status: 403 }
    );
  }

  const typedAlbum = album as Album;
  if (typedAlbum.status === "sold") {
    return NextResponse.json(
      { error: "Sold albums cannot be listed." },
      { status: 409 }
    );
  }

  if (typedAlbum.discogs_listing_id) {
    return NextResponse.json(
      { error: "Album is already listed on Discogs" },
      { status: 409 }
    );
  }

  const price = resolveListingPrice(
    listPrice,
    typedAlbum.list_price,
    typedAlbum.suggested_price
  );
  if (price === null) {
    return NextResponse.json(
      {
        error:
          "List price must be a positive number. Price the album or enter a list price before listing.",
      },
      { status: 400 }
    );
  }

  // Resolve the Discogs release ID — first from the album column, then from
  // the pricing cache raw_data where it's stored after a price fetch.
  let releaseId: number | null = typedAlbum.discogs_release_id ?? null;

  if (!releaseId) {
    const { data: cacheRow } = await supabase
      .from("pricing_cache")
      .select("raw_data")
      .eq("album_id", albumId)
      .eq("source", "discogs")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const raw = (cacheRow?.raw_data ?? {}) as Record<string, unknown>;
    releaseId = (raw.releaseId as number | undefined) ?? null;
  }

  if (!releaseId) {
    console.warn("[discogs]", {
      scope: "discogs",
      event: "list_missing_release_id",
      albumId,
    });
    return NextResponse.json(
      {
        error:
          "No Discogs release ID found for this album. Fetch prices first so VinylVault can identify the Discogs release.",
      },
      { status: 400 }
    );
  }

  console.log("[discogs]", {
    scope: "discogs",
    event: "list_start",
    albumId,
    releaseId,
    condition: typedAlbum.condition,
    price,
    authType: discogsAuth.tokenSecret ? "oauth" : "token",
  });

  // Use stored AI description as the Discogs listing comment. Generate on the
  // fly if ANTHROPIC_API_KEY is set and one hasn't been written yet.
  let comments: string | undefined = typedAlbum.listing_description ?? typedAlbum.notes ?? undefined;
  if (!typedAlbum.listing_description && process.env.ANTHROPIC_API_KEY) {
    try {
      comments = await generateListingDescription({
        artist: typedAlbum.artist,
        title: typedAlbum.title,
        genre: typedAlbum.genre,
        condition: typedAlbum.condition as AlbumCondition,
        catalogNumber: typedAlbum.catalog_number,
        notes: typedAlbum.notes,
        suggestedPrice: price,
        platform: "discogs",
      });
      await supabase
        .from("albums")
        .update({ listing_description: comments })
        .eq("id", albumId);
    } catch {
      // Fall back to notes
    }
  }

  try {
    const { listingId, listingUrl } = await createDiscogsListing({
      releaseId,
      condition: typedAlbum.condition as AlbumCondition,
      price,
      token: discogsAuth,
      comments,
    });

    // Verify the listing landed as "For Sale" — if it comes back as anything
    // else the seller account setup is incomplete on Discogs.
    const status = await getDiscogsListingStatus(listingId, discogsAuth).catch(
      () => null
    );
    const sellerWarning =
      status && status.status !== "For Sale"
        ? `Listing created but status is "${status.status}" — visit discogs.com/sell/manage to complete your seller setup and make it public.`
        : undefined;

    const { error: updateError } = await supabase
      .from("albums")
      .update({
        status: "listed",
        discogs_listing_id: String(listingId),
        discogs_listing_url: listingUrl,
        discogs_release_id: releaseId,
        list_price: price,
      })
      .eq("id", albumId);

    if (updateError) {
      console.error("[discogs]", {
        scope: "discogs",
        event: "list_persist_failed",
        albumId,
        listingId,
        message: updateError.message,
      });
      return NextResponse.json(
        {
          error:
            "Discogs listing was created, but VinylVault could not save the listing state. Avoid retrying until the listing is reconciled.",
          listingId,
          listingUrl,
        },
        { status: 500 }
      );
    }

    console.log("[discogs]", {
      scope: "discogs",
      event: "list_success",
      albumId,
      listingId,
      listingStatus: status?.status,
    });

    return NextResponse.json({ listingId, listingUrl, warning: sellerWarning });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discogs listing failed";
    // DiscogsError carries the upstream HTTP status; map it through so the
    // client sees 400/401/403/422 instead of a blanket 502.
    const httpStatus =
      err instanceof DiscogsError
        ? err.status >= 400 && err.status < 600
          ? err.status
          : 502
        : 502;

    console.error("[discogs]", {
      scope: "discogs",
      event: "list_failed",
      albumId,
      releaseId,
      httpStatus,
      message,
    });

    return NextResponse.json({ error: message }, { status: httpStatus });
  }
}
