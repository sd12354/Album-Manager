import { describe, expect, it } from "vitest";
import { reconstructPricingFromCache } from "./pricing-cache";

describe("reconstructPricingFromCache", () => {
  it("rebuilds a Discogs condition-price suggestion from cache rows", () => {
    const result = reconstructPricingFromCache(
      [
        {
          source: "discogs",
          median_price: 10,
          lowest_price: 8,
          num_sales: 4,
          raw_data: {
            releaseId: 123,
            priceForCondition: 18,
            allConditionPrices: { "Very Good Plus (VG+)": 18 },
          },
        },
      ],
      "Great"
    );

    expect(result.suggestedPrice).toBe(18);
    expect(result.suggestionSource).toBe("discogs-condition");
    expect(result.discogsReleaseId).toBe(123);
  });

  it("uses eBay cache when Discogs cache has no usable price", () => {
    const result = reconstructPricingFromCache(
      [
        {
          source: "discogs",
          median_price: null,
          lowest_price: null,
          raw_data: { releaseId: 123 },
        },
        {
          source: "ebay",
          median_price: 20,
          lowest_price: 15,
          num_sales: 3,
          raw_data: { highest: 30, comparables: [15, 20, 30] },
        },
      ],
      "Great"
    );

    expect(result.suggestedPrice).toBe(17);
    expect(result.suggestionSource).toBe("ebay-active");
  });

  it("returns no suggestion when cache rows have no price signal", () => {
    const result = reconstructPricingFromCache(
      [
        {
          source: "discogs",
          median_price: null,
          lowest_price: null,
          raw_data: { releaseId: 123 },
        },
      ],
      "Great"
    );

    expect(result.suggestedPrice).toBe(3);
    expect(result.suggestionSource).toBeUndefined();
  });
});
