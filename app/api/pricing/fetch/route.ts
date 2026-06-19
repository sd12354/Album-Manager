import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDiscogsPricing } from "@/lib/discogs";
import { searchEbayActiveListings, type EbayPriceResult } from "@/lib/ebay";
import { buildCombinedPricing } from "@/lib/pricing";
import {
  canManage,
  getDiscogsAuthForOwner,
  getRoleForOwner,
} from "@/lib/collections";
import type { Album, AlbumCondition, PricingResult } from "@/types";

// Single-album fetch can issue ~12 sequential Discogs requests at 1.1s each
// (plus an eBay fallback). Pin to Node runtime + raise timeout for Vercel.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Skip remote fetches if we have a cached entry younger than this. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheRow {
  source: "discogs" | "ebay";
  median_price?: number | null;
  lowest_price?: number | null;
  num_sales?: number | null;
  raw_data?: Record<string, unknown> | null;
  fetched_at: string;
}

function isFresh(row?: CacheRow): boolean {
  if (!row?.fetched_at) return false;
  return Date.now() - new Date(row.fetched_at).getTime() < CACHE_TTL_MS;
}

function buildFromCache(
  album: Album,
  discogsRow?: CacheRow,
  ebayRow?: CacheRow
): PricingResult {
  const result: PricingResult = {
    suggestedPrice: album.suggested_price ?? 0,
    confidence: "low",
  };

  if (discogsRow) {
    const raw = (discogsRow.raw_data ?? {}) as Record<string, unknown>;
    result.discogsMedian = discogsRow.median_price ?? undefined;
    result.discogsLowest = discogsRow.lowest_price ?? undefined;
    result.discogsSalesCount = discogsRow.num_sales ?? undefined;
    result.discogsReleaseId = raw.releaseId as number | undefined;
    result.discogsReleaseTitle = raw.releaseTitle as string | undefined;
    result.discogsReleaseYear = raw.releaseYear as string | undefined;
    result.discogsPriceForCondition = raw.priceForCondition as
      | number
      | undefined;
    result.discogsConditionPrices = raw.allConditionPrices as
      | Record<string, number>
      | undefined;
    if (result.discogsPriceForCondition != null) {
      result.suggestionSource = "discogs-condition";
    } else if (result.discogsMedian != null) {
      result.suggestionSource = "discogs-median";
    }
    result.confidence =
      (raw.confidence as PricingResult["confidence"]) ?? "low";
  }

  if (ebayRow) {
    const raw = (ebayRow.raw_data ?? {}) as Record<string, unknown>;
    result.ebayMedian = ebayRow.median_price ?? undefined;
    result.ebayLowest = ebayRow.lowest_price ?? undefined;
    result.ebayHighest = raw.highest as number | undefined;
    result.ebayComparables = raw.comparables as number[] | undefined;
    result.ebayCount = ebayRow.num_sales ?? undefined;
    result.ebaySampleListings = raw.sampleListings as
      | PricingResult["ebaySampleListings"];
    if (!result.suggestionSource && result.ebayMedian != null) {
      result.suggestionSource = "ebay-active";
    }
  }

  result.notice = "Showing cached pricing (fetched within last 24h).";
  return result;
}

async function persistDiscogsReleaseId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  albumId: string,
  ownerId: string,
  releaseId?: number
) {
  if (!releaseId) return;
  const { error } = await supabase
    .from("albums")
    .update({ discogs_release_id: releaseId })
    .eq("id", albumId)
    .eq("user_id", ownerId);

  if (error) {
    throw new Error(`Failed to save Discogs release ID: ${error.message}`);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { albumId, force } = body as { albumId?: string; force?: boolean };

  if (!albumId) {
    return NextResponse.json({ error: "albumId required" }, { status: 400 });
  }

  const { data: album, error: fetchError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .single();

  if (fetchError || !album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const typedAlbum = album as Album;
  const role = await getRoleForOwner(user, typedAlbum.user_id);
  if (!canManage(role)) {
    return NextResponse.json(
      { error: "You need editor access to refresh pricing for this album." },
      { status: 403 }
    );
  }
  const discogsAuth = await getDiscogsAuthForOwner(user, typedAlbum.user_id);

  // ===== Cache check =====
  if (!force) {
    const { data: cacheRows } = await supabase
      .from("pricing_cache")
      .select("*")
      .eq("album_id", albumId)
      .order("fetched_at", { ascending: false });

    const rows = (cacheRows ?? []) as CacheRow[];
    const discogsRow = rows.find((r) => r.source === "discogs");
    const ebayRow = rows.find((r) => r.source === "ebay");
    if (isFresh(discogsRow) || isFresh(ebayRow)) {
      const cachedReleaseId = (discogsRow?.raw_data ?? {}).releaseId as
        | number
        | undefined;
      await persistDiscogsReleaseId(
        supabase,
        albumId,
        typedAlbum.user_id,
        cachedReleaseId
      );
      return NextResponse.json(
        buildFromCache(
          typedAlbum,
          isFresh(discogsRow) ? discogsRow : undefined,
          isFresh(ebayRow) ? ebayRow : undefined
        )
      );
    }
  }

  // ===== Live fetch: Discogs first =====
  const discogsResult = discogsAuth
    ? await fetchDiscogsPricing(
        typedAlbum.artist,
        typedAlbum.title,
        typedAlbum.catalog_number ?? undefined,
        typedAlbum.condition as AlbumCondition,
        discogsAuth
      )
    : null;

  const discogsHasPricing =
    discogsResult?.priceForCondition != null ||
    discogsResult?.median != null;

  // ===== Fallback: eBay Browse API if Discogs didn't give us pricing =====
  let ebayResult: EbayPriceResult | null = null;
  if (!discogsHasPricing) {
    ebayResult = await searchEbayActiveListings(
      typedAlbum.artist,
      typedAlbum.title,
      { genre: typedAlbum.genre }
    );
  }

  const pricing = buildCombinedPricing(
    discogsResult?.releaseId ? discogsResult : null,
    ebayResult && ebayResult.count > 0 ? ebayResult : null,
    typedAlbum.condition as AlbumCondition
  );

  // ===== Compose notice for partial / no-match outcomes =====
  if (!pricing.suggestionSource) {
    // Nothing produced a suggested price.
    const reasons: string[] = [];
    if (!discogsAuth) reasons.push("Discogs not connected");
    if (discogsResult?.error) reasons.push(discogsResult.error);
    if (ebayResult?.error) reasons.push(ebayResult.error);
    if (reasons.length === 0) {
      reasons.push(
        "Neither Discogs nor eBay returned pricing for this album."
      );
    }
    pricing.notice = reasons.join(" · ");
  } else if (pricing.suggestionSource === "ebay-active") {
    pricing.notice = `Discogs had no pricing for this release — using eBay active-listing comparables instead (active asking prices, ~15% above sold).`;
  } else if (
    pricing.suggestionSource.startsWith("discogs") &&
    discogsResult?.matchedVia
  ) {
    // Helpful diagnostic so the user can verify the match.
    // Don't overwrite existing notice if any.
    if (!pricing.notice) {
      pricing.notice = undefined;
    }
  }

  // ===== Persist to cache =====
  const cacheRows: Array<Record<string, unknown>> = [];
  if (discogsResult?.releaseId) {
    cacheRows.push({
      album_id: albumId,
      source: "discogs",
      median_price: discogsResult.median ?? null,
      lowest_price: discogsResult.lowest ?? null,
      num_sales: discogsResult.numForSale ?? null,
      raw_data: {
        releaseId: discogsResult.releaseId,
        releaseTitle: discogsResult.releaseTitle,
        releaseYear: discogsResult.releaseYear,
        priceForCondition: discogsResult.priceForCondition,
        allConditionPrices: discogsResult.allConditionPrices,
        matchedVia: discogsResult.matchedVia,
        confidence: pricing.confidence,
      },
      fetched_at: new Date().toISOString(),
    });
  }
  if (ebayResult && ebayResult.count > 0) {
    cacheRows.push({
      album_id: albumId,
      source: "ebay",
      median_price: ebayResult.median ?? null,
      lowest_price: ebayResult.lowest ?? null,
      num_sales: ebayResult.count,
      raw_data: {
        comparables: ebayResult.comparables,
        highest: ebayResult.highest,
        sampleListings: ebayResult.sampleListings,
      },
      fetched_at: new Date().toISOString(),
    });
  }
  if (cacheRows.length > 0) {
    const { error: cacheError } = await supabase
      .from("pricing_cache")
      .upsert(cacheRows, { onConflict: "album_id,source" });

    if (cacheError) {
      return NextResponse.json(
        { error: `Failed to save pricing cache: ${cacheError.message}` },
        { status: 500 }
      );
    }
  }

  // ===== Update album row =====
  if (pricing.suggestionSource) {
    const { error: updateError } = await supabase
      .from("albums")
      .update({
        suggested_price: pricing.suggestedPrice,
        discogs_release_id: discogsResult?.releaseId ?? typedAlbum.discogs_release_id,
        status:
          typedAlbum.status === "unlisted" ? "pricing" : typedAlbum.status,
      })
      .eq("id", albumId)
      .eq("user_id", typedAlbum.user_id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to save album pricing: ${updateError.message}` },
        { status: 500 }
      );
    }
  } else {
    try {
      await persistDiscogsReleaseId(
        supabase,
        albumId,
        typedAlbum.user_id,
        discogsResult?.releaseId
      );
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to save Discogs release ID",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(pricing);
}
