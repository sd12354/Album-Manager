import type { AlbumCondition, PricingResult } from "@/types";
import type { DiscogsPriceResult } from "@/lib/discogs";
import type { EbayPriceResult } from "@/lib/ebay";

export const CONDITION_MULTIPLIERS: Record<AlbumCondition, number> = {
  Mint: 1.3,
  Great: 1.0,
  Good: 0.75,
  Fair: 0.5,
  Poor: 0.25,
};

export const DEFAULT_MINIMUM_FLOOR = 3.0;

export function computeSuggestedPrice(
  discogsMedian: number | undefined,
  ebayMedian: number | undefined,
  condition: AlbumCondition,
  minimumFloor = DEFAULT_MINIMUM_FLOOR,
  customMultipliers?: Partial<Record<AlbumCondition, number>>
): number {
  const prices = [discogsMedian, ebayMedian].filter(
    (p): p is number => p != null && p > 0
  );

  if (prices.length === 0) return minimumFloor;

  prices.sort((a, b) => a - b);
  const median =
    prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)];

  const multiplier =
    customMultipliers?.[condition] ?? CONDITION_MULTIPLIERS[condition];
  const suggested = Math.round(median * multiplier * 100) / 100;
  return Math.max(suggested, minimumFloor);
}

export function getConfidenceLevel(
  salesCount: number
): "low" | "medium" | "high" {
  if (salesCount >= 10) return "high";
  if (salesCount >= 3) return "medium";
  return "low";
}

/**
 * Build a PricingResult from a Discogs response. When Discogs gives us a
 * condition-specific price suggestion we prefer that (Discogs grades the 8
 * standard vinyl conditions and the suggestion already reflects that grade).
 * Otherwise we fall back to median × condition multiplier with the floor.
 */
export function buildPricingFromDiscogs(
  discogs: DiscogsPriceResult,
  condition: AlbumCondition,
  minimumFloor = DEFAULT_MINIMUM_FLOOR,
  customMultipliers?: Partial<Record<AlbumCondition, number>>
): PricingResult {
  const conditionPrice = discogs.priceForCondition;
  const median = discogs.median;

  let suggestedPrice: number;
  if (conditionPrice != null) {
    suggestedPrice = Math.max(
      Math.round(conditionPrice * 100) / 100,
      minimumFloor
    );
  } else {
    suggestedPrice = computeSuggestedPrice(
      median,
      undefined,
      condition,
      minimumFloor,
      customMultipliers
    );
  }

  const confidence = getConfidenceLevel(discogs.numForSale ?? 0);

  return {
    discogsMedian: median,
    discogsLowest: discogs.lowest,
    discogsSalesCount: discogs.numForSale,
    discogsReleaseId: discogs.releaseId,
    discogsReleaseTitle: discogs.releaseTitle,
    discogsReleaseYear: discogs.releaseYear,
    discogsPriceForCondition: conditionPrice,
    discogsConditionPrices: discogs.allConditionPrices,
    suggestedPrice,
    confidence,
  };
}

/**
 * Combine Discogs + eBay results into a single PricingResult. Precedence:
 *   1. Discogs condition-graded suggestion (most accurate — Discogs knows
 *      the exact condition grade and prices per grade)
 *   2. Discogs median × condition multiplier (still anchored on Discogs)
 *   3. eBay median × condition multiplier × 0.85 discount (eBay shows ASKING
 *      prices on active listings; actual sold prices typically ~15% lower)
 *   4. Minimum floor
 *
 * Confidence is taken from whichever source contributed the suggested price.
 */
export function buildCombinedPricing(
  discogs: DiscogsPriceResult | null,
  ebay: EbayPriceResult | null,
  condition: AlbumCondition,
  minimumFloor = DEFAULT_MINIMUM_FLOOR,
  customMultipliers?: Partial<Record<AlbumCondition, number>>
): PricingResult {
  const result: PricingResult = {
    suggestedPrice: minimumFloor,
    confidence: "low",
  };

  if (discogs?.releaseId) {
    result.discogsMedian = discogs.median;
    result.discogsLowest = discogs.lowest;
    result.discogsSalesCount = discogs.numForSale;
    result.discogsReleaseId = discogs.releaseId;
    result.discogsReleaseTitle = discogs.releaseTitle;
    result.discogsReleaseYear = discogs.releaseYear;
    result.discogsPriceForCondition = discogs.priceForCondition;
    result.discogsConditionPrices = discogs.allConditionPrices;
  }

  if (ebay && ebay.count > 0) {
    result.ebayMedian = ebay.median;
    result.ebayComparables = ebay.comparables;
    result.ebayLowest = ebay.lowest;
    result.ebayHighest = ebay.highest;
    result.ebaySampleListings = ebay.sampleListings;
    result.ebayCount = ebay.count;
  }

  // Decide suggested price + confidence based on best available signal.
  if (discogs?.priceForCondition != null) {
    result.suggestedPrice = Math.max(
      Math.round(discogs.priceForCondition * 100) / 100,
      minimumFloor
    );
    result.confidence = getConfidenceLevel(discogs.numForSale ?? 0);
    result.suggestionSource = "discogs-condition";
  } else if (discogs?.median != null) {
    result.suggestedPrice = computeSuggestedPrice(
      discogs.median,
      undefined,
      condition,
      minimumFloor,
      customMultipliers
    );
    result.confidence = getConfidenceLevel(discogs.numForSale ?? 0);
    result.suggestionSource = "discogs-median";
  } else if (ebay?.median != null) {
    // Ebay listings are ASKING prices on active listings — sold prices run
    // ~15% lower on average. Apply that discount, then condition multiplier.
    const soldEstimate = ebay.median * 0.85;
    result.suggestedPrice = computeSuggestedPrice(
      soldEstimate,
      undefined,
      condition,
      minimumFloor,
      customMultipliers
    );
    result.confidence = getConfidenceLevel(ebay.count);
    result.suggestionSource = "ebay-active";
  }

  return result;
}

export function generateMockPricing(
  artist: string,
  title: string,
  condition: AlbumCondition
) {
  const seed = (artist + title).length;
  const basePrice = 15 + (seed % 40);
  const discogsMedian = basePrice + (seed % 10);
  const discogsLowest = discogsMedian - 5;
  const discogsSalesCount = 2 + (seed % 15);
  const ebayComparables = [
    basePrice - 2,
    basePrice,
    basePrice + 3,
    basePrice + 5,
    basePrice + 8,
  ];
  const ebayMedian =
    ebayComparables.reduce((a, b) => a + b, 0) / ebayComparables.length;

  const suggestedPrice = computeSuggestedPrice(
    discogsMedian,
    ebayMedian,
    condition
  );

  return {
    discogsMedian,
    discogsLowest,
    discogsSalesCount,
    ebayMedian,
    ebayComparables,
    suggestedPrice,
    confidence: getConfidenceLevel(discogsSalesCount),
  };
}
