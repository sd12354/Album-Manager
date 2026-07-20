import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDiscogsPricing, type DiscogsAuth } from "@/lib/discogs";
import { searchEbayActiveListings, type EbayPriceResult } from "@/lib/ebay";
import { buildCombinedPricing } from "@/lib/pricing";
import {
  canManage,
  getDiscogsAuthForOwner,
  getRoleForOwner,
} from "@/lib/collections";
import type { Album, AlbumCondition, PricingResult } from "@/types";

// Bulk pricing is sequential and each album can issue multiple Discogs searches
// plus an eBay fallback. Keep each request small so Vercel doesn't terminate it
// near the 60s serverless limit; the client chunks larger selections.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedPricingRow {
  source: string;
  median_price: number | null;
  lowest_price: number | null;
  raw_data: Record<string, unknown> | null;
}

/**
 * Rebuild a PricingResult from cached rows so we can apply the existing
 * suggestion to an album row whose suggested_price was lost without
 * re-hitting Discogs/eBay.
 */
function reconstructPricingFromCache(
  rows: CachedPricingRow[],
  condition: AlbumCondition
): PricingResult {
  const discogsRow = rows.find((r) => r.source === "discogs");
  const ebayRow = rows.find((r) => r.source === "ebay");

  const discogsResult =
    discogsRow && typeof discogsRow.raw_data === "object" && discogsRow.raw_data
      ? {
          releaseId:
            (discogsRow.raw_data.releaseId as number | undefined) ?? undefined,
          releaseTitle: discogsRow.raw_data.releaseTitle as string | undefined,
          releaseYear: discogsRow.raw_data.releaseYear as string | undefined,
          median: discogsRow.median_price ?? undefined,
          lowest: discogsRow.lowest_price ?? undefined,
          numForSale: undefined as number | undefined,
          priceForCondition:
            (discogsRow.raw_data.priceForCondition as number | undefined) ??
            undefined,
          allConditionPrices:
            (discogsRow.raw_data.allConditionPrices as
              | Record<string, number>
              | undefined) ?? undefined,
          matchedVia: undefined as string | undefined,
        }
      : null;

  const ebayResult =
    ebayRow && typeof ebayRow.raw_data === "object" && ebayRow.raw_data
      ? {
          median: ebayRow.median_price ?? undefined,
          lowest: ebayRow.lowest_price ?? undefined,
          highest:
            (ebayRow.raw_data.highest as number | undefined) ?? undefined,
          comparables:
            (ebayRow.raw_data.comparables as number[] | undefined) ?? [],
          sampleListings:
            (ebayRow.raw_data.sampleListings as
              | Array<{ price: number; title: string; url: string }>
              | undefined) ?? [],
          count:
            (ebayRow.raw_data.comparables as number[] | undefined)?.length ?? 0,
        }
      : null;

  return buildCombinedPricing(
    discogsResult?.releaseId ? discogsResult : null,
    ebayResult && ebayResult.count > 0 ? ebayResult : null,
    condition
  );
}
const MAX_BULK = 3;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { albumIds, force } = body as { albumIds?: string[]; force?: boolean };

  if (!albumIds || !Array.isArray(albumIds) || albumIds.length === 0) {
    return NextResponse.json({ error: "albumIds required" }, { status: 400 });
  }

  if (albumIds.length > MAX_BULK) {
    return NextResponse.json(
      {
        error: `Bulk pricing is capped at ${MAX_BULK} albums per request to stay under the 60s serverless function limit. Got ${albumIds.length}.`,
      },
      { status: 400 }
    );
  }

  type BulkResult =
    | { albumId: string; status: "ok" | "cached"; source: NonNullable<PricingResult["suggestionSource"]> }
    | { albumId: string; status: "no_data" | "no_pricing"; notice: string }
    | { albumId: string; status: "error"; error: string };

  const results: BulkResult[] = [];
  const discogsAuthByOwner = new Map<string, DiscogsAuth | null>();

  for (const albumId of albumIds) {
    try {
      const { data: album, error: albumError } = await supabase
        .from("albums")
        .select("*")
        .eq("id", albumId)
        .single();

      if (albumError) {
        results.push({ albumId, status: "error", error: albumError.message });
        continue;
      }

      if (!album) {
        results.push({ albumId, status: "error", error: "Album not found" });
        continue;
      }

      const typedAlbum = album as Album;
      const role = await getRoleForOwner(user, typedAlbum.user_id);
      if (!canManage(role)) {
        results.push({
          albumId,
          status: "error",
          error: "You need editor access to refresh pricing for this album.",
        });
        continue;
      }
      let discogsAuth = discogsAuthByOwner.get(typedAlbum.user_id);
      if (!discogsAuthByOwner.has(typedAlbum.user_id)) {
        discogsAuth = await getDiscogsAuthForOwner(user, typedAlbum.user_id);
        discogsAuthByOwner.set(typedAlbum.user_id, discogsAuth);
      }

      // Cache check. We need the actual price data here, not just the source,
      // because the album row may have lost its suggested_price (manual edit,
      // CSV re-import overwrite, etc.) since the cache was written. Returning
      // "cached" without reapplying the price was the bug behind users
      // selecting albums to price and seeing nothing happen.
      if (!force) {
        const { data: cached } = await supabase
          .from("pricing_cache")
          .select("source, fetched_at, median_price, lowest_price, raw_data")
          .eq("album_id", albumId)
          .order("fetched_at", { ascending: false });
        const freshRows = (cached ?? []).filter(
          (r) =>
            r.fetched_at &&
            Date.now() - new Date(r.fetched_at).getTime() < CACHE_TTL_MS
        );
        if (freshRows.length > 0) {
          const cachedPricing = reconstructPricingFromCache(
            freshRows,
            typedAlbum.condition as AlbumCondition
          );
          if (
            cachedPricing.suggestionSource &&
            cachedPricing.suggestedPrice > 0
          ) {
            // Backfill the album row if its suggested_price was lost.
            const needsUpdate =
              (typedAlbum.suggested_price ?? 0) <= 0 ||
              typedAlbum.suggested_price !== cachedPricing.suggestedPrice;
            if (needsUpdate) {
              const { error: cachedUpdateError } = await supabase
                .from("albums")
                .update({
                  suggested_price: cachedPricing.suggestedPrice,
                  discogs_release_id:
                    cachedPricing.discogsReleaseId ??
                    typedAlbum.discogs_release_id,
                  status:
                    typedAlbum.status === "unlisted"
                      ? "pricing"
                      : typedAlbum.status,
                })
                .eq("id", albumId)
                .eq("user_id", typedAlbum.user_id);
              if (cachedUpdateError) {
                throw new Error(
                  `Failed to save cached album pricing: ${cachedUpdateError.message}`
                );
              }
            }
            results.push({
              albumId,
              status: "cached",
              source: cachedPricing.suggestionSource,
            });
            continue;
          }
          // Cache rows exist but contain no usable pricing — fall through to
          // re-fetch instead of returning a misleading "cached" status.
        }
      }

      // Discogs first
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

      // eBay fallback only if Discogs didn't produce pricing
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

      if (!pricing.suggestionSource) {
        // Differentiate "release was found but no marketplace data" from
        // "no release found at all" — they look identical to the user
        // otherwise, and the second one falsely implies the search is
        // broken. Discogs sets a releaseId when it found a release.
        const releaseFoundButNoPricing = !!discogsResult?.releaseId;
        const notice = releaseFoundButNoPricing
          ? `${discogsResult?.error ?? "Discogs had no pricing"}. eBay fallback also returned no results${ebayResult?.error ? `: ${ebayResult.error}` : ""}.`
          : (discogsResult?.error ??
              ebayResult?.error ??
              "No pricing data from Discogs or eBay.");
        results.push({
          albumId,
          status: releaseFoundButNoPricing ? "no_pricing" : "no_data",
          notice,
        });
        continue;
      }

      // Cache + update album
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
          throw new Error(`Failed to save pricing cache: ${cacheError.message}`);
        }
      }

      const { error: updateError } = await supabase
        .from("albums")
        .update({
          suggested_price: pricing.suggestedPrice,
          discogs_release_id:
            discogsResult?.releaseId ?? typedAlbum.discogs_release_id,
          status: typedAlbum.status === "unlisted" ? "pricing" : typedAlbum.status,
        })
        .eq("id", albumId)
        .eq("user_id", typedAlbum.user_id);
      if (updateError) {
        throw new Error(`Failed to save album pricing: ${updateError.message}`);
      }

      results.push({
        albumId,
        status: "ok",
        source: pricing.suggestionSource,
      });
    } catch (err) {
      results.push({
        albumId,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results });
}
