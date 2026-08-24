import type { AlbumCondition, PricingResult } from "@/types";
import type { DiscogsPriceResult } from "@/lib/discogs";
import type { EbayPriceResult } from "@/lib/ebay";
import { buildCombinedPricing } from "./pricing";

export interface CachedPricingRow {
  source: string;
  median_price?: number | null;
  lowest_price?: number | null;
  num_sales?: number | null;
  raw_data?: Record<string, unknown> | null;
}

/**
 * Rebuild a PricingResult from cached rows so cache hits behave like a fresh
 * fetch even if albums.suggested_price was cleared by an import or edit.
 */
export function reconstructPricingFromCache(
  rows: CachedPricingRow[],
  condition: AlbumCondition
): PricingResult {
  const discogsRow = rows.find((r) => r.source === "discogs");
  const ebayRow = rows.find((r) => r.source === "ebay");

  const discogsResult: DiscogsPriceResult | null =
    discogsRow && typeof discogsRow.raw_data === "object" && discogsRow.raw_data
      ? {
          releaseId:
            (discogsRow.raw_data.releaseId as number | undefined) ?? undefined,
          releaseTitle: discogsRow.raw_data.releaseTitle as string | undefined,
          releaseYear: discogsRow.raw_data.releaseYear as string | undefined,
          median: discogsRow.median_price ?? undefined,
          lowest: discogsRow.lowest_price ?? undefined,
          numForSale: discogsRow.num_sales ?? undefined,
          priceForCondition:
            (discogsRow.raw_data.priceForCondition as number | undefined) ??
            undefined,
          allConditionPrices:
            (discogsRow.raw_data.allConditionPrices as
              | Record<string, number>
              | undefined) ?? undefined,
          matchedVia: discogsRow.raw_data.matchedVia as string | undefined,
        }
      : null;

  const ebayResult: EbayPriceResult | null =
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
            ebayRow.num_sales ??
            (ebayRow.raw_data.comparables as number[] | undefined)?.length ??
            0,
        }
      : null;

  return buildCombinedPricing(
    discogsResult?.releaseId ? discogsResult : null,
    ebayResult && ebayResult.count > 0 ? ebayResult : null,
    condition
  );
}
