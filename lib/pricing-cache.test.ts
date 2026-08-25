import { describe, expect, it } from "vitest";
import { buildPricingFromCacheRows } from "./pricing-cache";

describe("pricing cache helpers", () => {
  it("reconstructs a suggested price from cached Discogs condition data", () => {
    const pricing = buildPricingFromCacheRows(
      [
        {
          source: "discogs",
          median_price: 20,
          lowest_price: 12,
          num_sales: 6,
          raw_data: {
            releaseId: 123,
            releaseTitle: "Buzz Buzz Buzz",
            releaseYear: "1957",
            priceForCondition: 18,
            allConditionPrices: { "Very Good Plus (VG+)": 18 },
            confidence: "medium",
          },
        },
      ],
      "Great",
      null
    );

    expect(pricing.suggestedPrice).toBe(18);
    expect(pricing.suggestionSource).toBe("discogs-condition");
    expect(pricing.discogsReleaseId).toBe(123);
    expect(pricing.notice).toMatch(/cached pricing/);
  });

  it("keeps a positive album suggestion when cache rows have no usable market data", () => {
    const pricing = buildPricingFromCacheRows([], "Good", 11);

    expect(pricing.suggestedPrice).toBe(11);
    expect(pricing.suggestionSource).toBeUndefined();
  });
});
