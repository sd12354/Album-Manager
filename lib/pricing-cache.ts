import type { AlbumCondition, PricingResult } from "../types";
import { buildCombinedPricing } from "./pricing";

export interface PricingCacheRow {
  source: string;
  median_price?: number | null;
  lowest_price?: number | null;
  num_sales?: number | null;
  raw_data?: Record<string, unknown> | null;
}

export function buildPricingFromCacheRows(
  rows: PricingCacheRow[],
  condition: AlbumCondition,
  albumSuggestedPrice?: number | null
): PricingResult {
  const discogsRow = rows.find((row) => row.source === "discogs");
  const ebayRow = rows.find((row) => row.source === "ebay");
  const discogsRaw = (discogsRow?.raw_data ?? {}) as Record<string, unknown>;
  const ebayRaw = (ebayRow?.raw_data ?? {}) as Record<string, unknown>;

  const discogsResult = discogsRow
    ? {
        releaseId: discogsRaw.releaseId as number | undefined,
        releaseTitle: discogsRaw.releaseTitle as string | undefined,
        releaseYear: discogsRaw.releaseYear as string | undefined,
        median: discogsRow.median_price ?? undefined,
        lowest: discogsRow.lowest_price ?? undefined,
        numForSale: discogsRow.num_sales ?? undefined,
        priceForCondition: discogsRaw.priceForCondition as number | undefined,
        allConditionPrices: discogsRaw.allConditionPrices as
          | Record<string, number>
          | undefined,
        matchedVia: discogsRaw.matchedVia as string | undefined,
      }
    : null;

  const comparables = ebayRaw.comparables as number[] | undefined;
  const ebayResult = ebayRow
    ? {
        median: ebayRow.median_price ?? undefined,
        lowest: ebayRow.lowest_price ?? undefined,
        highest: ebayRaw.highest as number | undefined,
        count: ebayRow.num_sales ?? comparables?.length ?? 0,
        comparables: comparables ?? [],
        sampleListings:
          (ebayRaw.sampleListings as PricingResult["ebaySampleListings"]) ?? [],
      }
    : null;

  const pricing = buildCombinedPricing(
    discogsResult?.releaseId ? discogsResult : null,
    ebayResult && ebayResult.count > 0 ? ebayResult : null,
    condition
  );

  if (
    pricing.suggestionSource &&
    typeof discogsRaw.confidence === "string" &&
    ["low", "medium", "high"].includes(discogsRaw.confidence)
  ) {
    pricing.confidence = discogsRaw.confidence as PricingResult["confidence"];
  }

  if (!pricing.suggestionSource && albumSuggestedPrice && albumSuggestedPrice > 0) {
    pricing.suggestedPrice = albumSuggestedPrice;
  }

  pricing.notice = "Showing cached pricing (fetched within last 24h).";
  return pricing;
}
