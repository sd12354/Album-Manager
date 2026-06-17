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
    | { albumId: string; status: "no_data"; notice: string }
    | { albumId: string; status: "error"; error: string };

  const results: BulkResult[] = [];
  const discogsAuthByOwner = new Map<string, DiscogsAuth | null>();

  for (const albumId of albumIds) {
    try {
      const { data: album } = await supabase
        .from("albums")
        .select("*")
        .eq("id", albumId)
        .single();

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

      // Cache check
      if (!force) {
        const { data: cached } = await supabase
          .from("pricing_cache")
          .select("source, fetched_at")
          .eq("album_id", albumId)
          .order("fetched_at", { ascending: false });
        const fresh = (cached ?? []).find(
          (r) =>
            r.fetched_at &&
            Date.now() - new Date(r.fetched_at).getTime() < CACHE_TTL_MS
        );
        if (fresh) {
          results.push({
            albumId,
            status: "cached",
            source:
              fresh.source === "ebay" ? "ebay-active" : "discogs-condition",
          });
          continue;
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
        results.push({
          albumId,
          status: "no_data",
          notice:
            discogsResult?.error ??
            ebayResult?.error ??
            "No pricing data from Discogs or eBay.",
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
        await supabase
          .from("pricing_cache")
          .upsert(cacheRows, { onConflict: "album_id,source" });
      }

      await supabase
        .from("albums")
        .update({
          suggested_price: pricing.suggestedPrice,
          discogs_release_id:
            discogsResult?.releaseId ?? typedAlbum.discogs_release_id,
          status: typedAlbum.status === "unlisted" ? "pricing" : typedAlbum.status,
        })
        .eq("id", albumId);

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
